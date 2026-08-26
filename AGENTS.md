# Project Instructions

This file provides shared guidance for AI coding tools working in this repository.

## OpenSpec and Git Workflow

- Use the repository's generated OpenSpec workflows.
- Before implementation, read `openspec/config.yaml`, the relevant main specs under `openspec/specs/`, and the active change artifacts under `openspec/changes/`.
- Keep OpenSpec artifacts aligned with the implementation and validate the completed change before archiving.

### Development entry gate

- Treat every request to implement, fix, refactor, add or change tests, change configuration, or change behavior documentation as development work.
- Before editing any implementation file, the agent MUST inspect the OpenSpec configuration, main specs, and active changes, then MUST select the applicable generated OpenSpec workflow instead of reconstructing it from memory.
- If no active change matches, the agent MUST use the generated propose workflow, create all required planning artifacts, present them, and stop. A proposal authorizes planning only; the agent MUST wait for a later explicit apply request before implementation.
- If exactly one active change matches and the user requests implementation, the agent MUST use the generated apply workflow and read every context file returned by its dynamic instructions. If several changes could match, list them and obtain the user's selection first.
- The agent MUST NOT edit implementation files while apply is blocked, before apply reports a ready state, or before all required context files have been read.
- Read-only explanation, investigation, status reporting, and OpenSpec tooling installation or repair are not development work. If such work turns into a request to edit project behavior, apply this gate before the first edit.

### Instruction file convention

- `AGENTS.md` is the canonical root instruction file for this repository.
- `CLAUDE.md` must be a relative symbolic link to `AGENTS.md`.
- This direction is an intentional project convention that reverses an earlier Claude-first layout. Do not flip the link or move the canonical content back into `CLAUDE.md` during installation, repair, or tool updates.

### Installation and updates

- After every successful OpenSpec installation, reinstallation, repair, or update, create a separate Git commit containing only the repository files that operation modified or created.
- Stage the exact affected paths explicitly. Do not mix application changes, archive changes, or unrelated work into the OpenSpec setup commit.
- Create the commit on `main` and follow the commit-message rules below. Prefer `chore(openspec): install OpenSpec tooling`, `chore(openspec): reinstall OpenSpec tooling`, or `chore(openspec): update OpenSpec tooling`, as applicable.
- Do not create an empty commit when the operation changed no repository files. Do not commit when the installation or update failed.
- Keep this setup commit separate from the automatic archive commit. After the setup commit succeeds, automatically push it to the authorized branch's configured upstream without waiting for another request. Do not push if setup or commit creation failed.

### During apply

- Follow the generated apply workflow's dynamic instructions and keep the current change's spec in sync throughout implementation.
- Read `openspec/config.yaml`, relevant main specs, every context file returned by apply, and all active change artifacts before changing implementation files.
- If implementation requires small bug fixes or feature tweaks beyond what the change originally described, promptly fold them back into the current change's `proposal.md`, delta specs under `openspec/changes/<name>/specs/`, and `tasks.md` as applicable.
- If a task requires unexpected scope beyond the artifacts, pause and surface it instead of silently narrowing, deferring, or simplifying specified behavior.
- Mark a task complete immediately after its full behavior and proportionate verification succeed; do not mark partial or deferred work complete.
- Do not let implementation drift ahead of the spec. Before archiving, ensure the change artifacts describe what was actually built.

### Archiving

- After all implementation tasks complete, validate the active change before archive. If archive has not been requested or completed, report the change as active and ready to archive rather than claiming it is archived.
- When `/opsx:archive` prompts about delta spec sync, default to syncing: choose `Sync now (recommended)` so the change's delta specs under `openspec/changes/<name>/specs/` are merged into the main specs under `openspec/specs/<capability>/spec.md`.
- Only skip syncing if the user explicitly asks to archive without syncing.
- After archiving, verify both the updated main specs and the archived change.
- Report explicitly whether the change remains active or has been successfully archived.
- After every successful archive, including the spec sync above, automatically commit the files involved in that change and push the commit to `main`. Do not wait for a separate request or confirmation.
- Do not auto-commit or push if the archive step fails.

### Concurrent-agent commits

- Assume multiple agents may be editing the same working tree.
- Track every file modified or created by the current task and inspect the final diff before staging.
- Stage only those exact paths with `git add -- <path>...`: the archived OpenSpec artifacts, synced main specs, and code or documentation modified by the change.
- Never use `git add -A`, `git add .`, or `git add -u`; those commands can sweep up other agents' work in progress.
- File-level staging is sufficient; line-level or hunk-level staging is not required.
- If a file was modified by both this change and another agent concurrently, it is acceptable to commit the whole file because the on-disk state is the state that runs. Confirm the final file list before committing and explicitly report any such shared file afterward.
- Do not amend, rewrite, or discard another agent's work.

### Concurrency-safe push to main

- All commits must be created on the `main` branch unless the user explicitly authorizes another branch for the current task.
- Before committing, confirm the checked-out branch is `main`, its upstream is `origin/main`, and the staged file list contains only the paths described above. If not on `main`, stop and report; do not switch branches or push another branch to `main` implicitly.
- Fetch `origin/main` and verify local `main` is not behind or diverged before committing. Do not merge, rebase, reset, stash, or alter other agents' working-tree changes automatically to catch up.
- Create the commit only after the archive and sync have succeeded and the final staged diff has been reviewed.
- Push with `git push origin main`. Never force-push.
- If the push is rejected because `origin/main` advanced, fetch and report the race. Do not rewrite history or disturb the shared working tree; leave the local commit intact and ask for the safest integration decision.

### Branches and worktrees

- Do not create or switch branches unless the user explicitly authorizes it for the current task.
- Do not create, enable, switch, manage, or move work into a Git worktree unless the user explicitly authorizes it for the current task.

### Commit messages

- Use Conventional Commits, following the Angular-style format, for every commit: `<type>(<scope>): <description>`.
- Use an appropriate standard type such as `feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`, or `chore`.
- Keep the subject concise and imperative.
- For a breaking change, add `!` before the colon and include a `BREAKING CHANGE:` footer.
- Example: `feat(research): add automated experiment runner`.
- For a pure OpenSpec archive, prefer `chore(openspec): archive <change-name>`.
- When implementation files are included, choose the conventional type and scope that best describe the change.

### Repository-specific OpenSpec and Git Workflow Requirements

- All changes must go through `/opsx:propose`, `/opsx:apply`, and `/opsx:archive`.
- Every code change must also update the corresponding documents in `docs/` (`frontend-architecture.md`, `external-api.md`, and `tech-stack.md`).
- This repository overrides the general Development entry gate above: unless the user explicitly asks to stop after proposal or defer implementation, after the generated propose workflow completes successfully and presents all planning artifacts, immediately continue into the generated apply workflow for the same change without waiting for a later explicit apply request.

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
