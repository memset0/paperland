# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Workflow

This project follows the **OpenSpec** workflow. All changes must go through:
1. `/opsx:propose` — create proposal, design, specs, tasks
2. `/opsx:apply` — implement tasks
3. `/opsx:archive` — archive completed changes

**Every code change must also update the corresponding docs in `docs/`** (frontend-architecture.md, external-api.md, tech-stack.md).

## Commands

```bash
# Install dependencies
bun install

# Run both backend + frontend (MUST run from project root)
bun run packages/backend/src/index.ts & bun run --filter '@paperland/frontend' dev

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

## Critical: Backend Must Run from Project Root

**NEVER** start the backend from `packages/backend/` or via `--filter '@paperland/backend'`. The database path in `config.yml` (`./data/paperland.db`) is resolved relative to CWD. If the backend runs from `packages/backend/`, it creates an empty database at `packages/backend/data/paperland.db` instead of using the real one at `data/paperland.db`.

- **Correct**: `bun run packages/backend/src/index.ts` (from project root)
- **Wrong**: `bun run --filter '@paperland/backend' dev` (CWD becomes `packages/backend/`)
- **Wrong**: `cd packages/backend && bun run src/index.ts`

**Commit safety check**: If `packages/backend/data/` appears in `git status`, something went wrong — this directory should never exist. Do NOT commit it. Investigate which process created it.

## Testing Caution

Some unit tests call real external services (arxiv, semantic scholar, OpenAI API) and **may incur costs**. Do not run all tests blindly. Only run specific tests you need, and ask before running tests that might hit external APIs.
