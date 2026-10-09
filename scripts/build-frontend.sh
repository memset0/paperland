#!/usr/bin/env bash
# Queued frontend build: at most one build runs on this machine at a time, and
# requests that queue up behind a running build are coalesced into one build.
#
#   bun run build:frontend                 # build packages/frontend/dist (served in production)
#   bun run build:frontend --out-dir DIR   # verification build into DIR (queued, merged only with the same DIR)
#
# State lives in data/build-queue/: meta.lock guards the counters, build.lock is
# held for the whole build (flock releases it when the process exits, even if killed).
# Per output directory <key>: requested (last registered sequence number),
# attempted (highest sequence number covered by a finished build), status, <key>.log.
# BUILD_QUEUE_CMD overrides the build command (used to test the queue itself).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$ROOT/packages/frontend"
QUEUE="$ROOT/data/build-queue"

OUT_DIR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --out-dir) OUT_DIR="${2:?--out-dir needs a directory}"; shift 2 ;;
    --out-dir=*) OUT_DIR="${1#--out-dir=}"; shift ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    *) echo "build-frontend: unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [ -n "$OUT_DIR" ]; then
  mkdir -p "$OUT_DIR"
  TARGET="$(cd "$OUT_DIR" && pwd)"
else
  TARGET="$FRONTEND/dist"
fi
KEY="$(printf '%s' "$TARGET" | sha1sum | cut -c1-12)"
mkdir -p "$QUEUE"
STATE="$QUEUE/$KEY"
LOG="$QUEUE/$KEY.log"
echo "$TARGET" > "$STATE.target"

read_num() { local v; v="$(cat "$1" 2>/dev/null)"; [[ "$v" =~ ^[0-9]+$ ]] && echo "$v" || echo 0; }

# 1. Register this request.
exec 8>"$QUEUE/meta.lock"
flock 8
MY=$(( $(read_num "$STATE.requested") + 1 ))
echo "$MY" > "$STATE.requested"
flock -u 8

# 2. Wait for the machine-wide build lock.
exec 9>"$QUEUE/build.lock"
if ! flock -n 9; then
  echo "build-frontend: another build is running; queued as request #$MY for $TARGET"
  flock 9
fi

# 3. Already covered by a build that started after we registered? Share its result.
if [ "$(read_num "$STATE.attempted")" -ge "$MY" ]; then
  STATUS="$(read_num "$STATE.status")"
  echo "build-frontend: request #$MY was merged into the build that just finished (exit $STATUS); log: $LOG"
  exit "$STATUS"
fi

# 4. Build, covering every request registered so far for this target.
flock 8
COVER="$(read_num "$STATE.requested")"
flock -u 8
echo "build-frontend: building $TARGET (covers requests #$MY-#$COVER); log: $LOG"

if [ -n "${BUILD_QUEUE_CMD:-}" ]; then
  CMD=(bash -c "$BUILD_QUEUE_CMD")
elif [ -n "$OUT_DIR" ]; then
  CMD=(bunx vite build --outDir "$TARGET" --emptyOutDir)
else
  CMD=(bun run build)
fi
(cd "$FRONTEND" && "${CMD[@]}") 2>&1 | tee "$LOG"
STATUS=${PIPESTATUS[0]}

flock 8
echo "$COVER" > "$STATE.attempted"
echo "$STATUS" > "$STATE.status"
flock -u 8
echo "build-frontend: finished with exit $STATUS"
exit "$STATUS"
