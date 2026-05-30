# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Workflow

This project follows the **OpenSpec** workflow. All changes must go through:
1. `/opsx:propose` — create proposal, design, specs, tasks
2. `/opsx:apply` — implement tasks
3. `/opsx:archive` — archive completed changes

**Every code change must also update the corresponding docs in `docs/`** (frontend-architecture.md, external-api.md, tech-stack.md).

### Keep the spec in sync during apply

If, **after** `/opsx:apply`, you make small bug fixes or feature tweaks beyond what the change originally described, promptly fold them back into the current change's spec (its `proposal.md`, delta specs under `openspec/changes/<name>/specs/`, and `tasks.md` as needed). Don't let the implementation drift ahead of the spec — the spec must reflect what was actually built before the change is archived.

### Sync delta specs to main specs when archiving

When `/opsx:archive` prompts about delta spec sync, **default to syncing** — i.e. choose "Sync now (recommended)" so the change's delta specs under `openspec/changes/<name>/specs/` are merged into the main specs under `openspec/specs/<capability>/spec.md`. Only skip syncing if the user explicitly asks to archive without syncing.

### Auto-commit after archiving

After running `/opsx:archive` **and** the change is archived successfully (including the spec sync above), automatically commit the files involved in that change to git, then push to `main`:

1. Stage **only the files your change touched**, by explicit path (its archived openspec artifacts, the synced main specs, plus the code/docs it modified). **Never** `git add -A` / `git add .` / `git add -u` — that would sweep up other agents' work-in-progress.
2. If a file was modified by both this change and another agent concurrently, it's fine to commit the whole file (including a little of the other agent's work) — the on-disk state is the one that runs. Just confirm the final file list before committing.
3. Commit, then push to `main` using the concurrency-safe protocol below.

Do **not** auto-commit if the archive step failed.

#### Concurrent agents: rebase onto the live `main` before pushing

Multiple agents may be editing this shared working tree and pushing to `main` at the same time. Their combined uncommitted changes are known to run fine together; the only real hazard is a push conflict on `main`. To avoid it, **never assume your local `main` (the HEAD scanned at session start) is current** — always re-sync onto the live remote tip immediately before pushing:

```bash
git add <only the files your change touched>     # explicit paths, never -A / . / -u
git commit -m "<message>"
git fetch origin main
git rebase origin/main                            # replay your commit onto the latest tip
git push origin HEAD:main
```

Retry on contention (a few times, with a short backoff):
- **Push rejected (non-fast-forward)** — another agent pushed between your `fetch` and `push`. Re-run `git fetch origin main && git rebase origin/main && git push origin HEAD:main`.
- **`index.lock` / `*.lock` already exists** — another agent's git command is mid-flight in the shared repo. This is a *safe* abort (git won't corrupt anything); wait ~2s and retry the same command.

Because each agent stages only its own files and the on-disk content already runs as a whole, the rebase almost always replays cleanly. Do **not** reach for tree-wide operations to "fix" a snag — no `git stash` / `git pull --autostash` / `git checkout .` / `git reset --hard` / `git clean`. They would clobber files other agents are still editing. If a rebase aborts complaining about *unstaged changes to files you don't own*, an agent is mid-edit: wait and retry, and if it stays blocked, stop and report rather than disturbing their work.

> Cleanest isolation (optional): run each concurrent agent in its own `git worktree`, so indexes and working files can't collide and the rebase is always clean — only `origin/main` is shared. The retry protocol above is what makes in-place, shared-tree work safe when worktrees aren't used.

## Commands

```bash
# Install dependencies
bun install

# Run both backend + frontend (MUST run from project root)
bun run dev

# Equivalent to (but prefer `bun run dev`):
# bun run packages/backend/src/index.ts & bun run --filter '@paperland/frontend' dev

# Run backend only (port 3000, localhost only, MUST run from project root)
bun run packages/backend/src/index.ts

# Run frontend only (port 5173, 0.0.0.0, proxies API to backend)
bun run --filter '@paperland/frontend' dev

# Run backend tests
bun run --filter '@paperland/backend' test

# Generate Drizzle migration after schema changes
cd packages/backend && bunx drizzle-kit generate

# Check openspec status
npx openspec list --json
npx openspec status --change "<name>" --json
```

## Architecture

Bun workspace monorepo with three packages:

- **@paperland/shared** (`packages/shared/`) — TypeScript types only, no runtime deps
- **@paperland/backend** (`packages/backend/`) — Fastify server, Drizzle ORM, bun:sqlite
- **@paperland/frontend** (`packages/frontend/`) — Vue 3 + Vite + Pinia

All traffic goes through port 5173 (Vite). Backend listens on 127.0.0.1:3000, accessed only via Vite proxy. Login: credentials from `config.yml`.

### Auth

- `/api/*` — HTTP Basic Auth (credentials in `config.yml` auth.users)
- `/external-api/*` — Bearer Token (tokens in `api_tokens` table)
- `/api/health` — no auth

### Database

SQLite via `bun:sqlite` + `drizzle-orm/bun-sqlite` (NOT better-sqlite3 — incompatible with Bun). WAL mode enabled. Daily backup to `data/backups/` with 30-day retention.

Tables: papers, tags, paper_tags, qa_entries, qa_results, service_executions, api_tokens.

### Services

Two categories:
- **Paper-bound services** — declare `depends_on`/`produces` for automatic dependency-graph scheduling
- **Pure services** (e.g. qa_service) — manual trigger only, no dependency graph

Each service has `max_concurrency` and `rate_limit_interval` config. Services are in `packages/backend/src/services/`.

## Key Conventions

- **snake_case everywhere** — all API response keys, DB fields, JSON keys
- **config.yml** — single source of truth for all config (database, auth, services, models, content_priority)
- **Zod validation** — config loaded and validated at startup via `packages/backend/src/config.ts`
- **Q&A context priority** — `content_priority` in config.yml determines which text source to use (user_input > pdf_parsed)
- **Paper basic fields** (title, abstract, authors) — not managed by service dependency graph; any fetch service fills them if empty
- **Templates** — Q&A prompt templates are defined in `config.yml` via `system_prompt` (paper+question assembly template using `{PAPER}` and `{PROMPT}` placeholders) and `qa` (ordered list of template questions with `name` and `prompt`)
- **Unified page layout (`AppPage`)** — every top-level "management" page (anything reachable from the sidebar that isn't a detail page) MUST wrap its content in `components/AppPage.vue` instead of hand-writing its own page header / width container. `AppPage` owns the page title + icon (taken from the route's `meta.title` / `meta.icon`, so set those on the route) and the centered content width. Put top-right buttons in the `#actions` slot; pass `full` for wide list/gallery/board pages, `fill` for pages that manage their own internal scroll (e.g. Q&A). Do NOT add a second `<h1>` inside — the header is the component's job. Detail pages (`/papers/:id`, `/idea-forge/:projectName`) intentionally do NOT use it. **When you create a new page, register its route with `meta.title`+`meta.icon`, add the sidebar entry in `App.vue`, and wrap the view in `<AppPage>`.** See `docs/frontend-architecture.md` → "页面布局".

## Critical: Backend Must Run from Project Root

**NEVER** start the backend from `packages/backend/` or via `--filter '@paperland/backend'`. The database path in `config.yml` (`./data/paperland.db`) is resolved relative to CWD. If the backend runs from `packages/backend/`, it creates an empty database at `packages/backend/data/paperland.db` instead of using the real one at `data/paperland.db`.

- **Correct**: `bun run packages/backend/src/index.ts` (from project root)
- **Wrong**: `bun run --filter '@paperland/backend' dev` (CWD becomes `packages/backend/`)
- **Wrong**: `cd packages/backend && bun run src/index.ts`

**Commit safety check**: If `packages/backend/data/` appears in `git status`, something went wrong — this directory should never exist. Do NOT commit it. Investigate which process created it.

## Testing Caution

Some unit tests call real external services (arxiv, semantic scholar, OpenAI API) and **may incur costs**. Do not run all tests blindly. Only run specific tests you need, and ask before running tests that might hit external APIs.
