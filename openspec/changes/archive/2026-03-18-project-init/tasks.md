## 1. Monorepo Scaffolding

- [x] 1.1 Create root package.json with Bun workspaces config pointing to packages/*
- [x] 1.2 Create tsconfig.base.json with shared TypeScript compiler options
- [x] 1.3 Scaffold packages/shared with package.json, tsconfig.json, and src/types.ts
- [x] 1.4 Scaffold packages/backend with package.json, tsconfig.json, and src/index.ts entry point
- [x] 1.5 Scaffold packages/frontend with Vue 3 + Vite (create-vue or manual), tsconfig.json, vite.config.ts
- [x] 1.6 Run `bun install` and verify all packages resolve correctly

## 2. Shared Types

- [x] 2.1 Define Paper type with all fields (id, arxiv_id, corpus_id, title, authors, abstract, contents, pdf_path, metadata, created_at)
- [x] 2.2 Define Tag, PaperTag types
- [x] 2.3 Define QAEntry (id, paper_id, type, template_name) and QAResult (id, qa_entry_id, prompt, answer, model_name, completed_at) types
- [x] 2.4 Define ServiceExecution type (id, service_name, paper_id, status, progress, created_at, finished_at, result, error)
- [x] 2.5 Define ApiToken type (id, token, created_at, revoked_at)
- [x] 2.6 Define Config type (database, auth, services, models, content_priority) and export from shared

## 3. Config Loading

- [x] 3.1 Install js-yaml and zod in packages/backend
- [x] 3.2 Create packages/backend/src/config.ts with Zod schema matching config.yml structure
- [x] 3.3 Implement loadConfig() that reads config.yml from project root, parses with js-yaml, validates with Zod
- [x] 3.4 Create a default config.yml in project root with example values
- [ ] 3.5 Write unit test for config loading (valid, missing file, invalid schema)

## 4. Database Schema

- [x] 4.1 Install drizzle-orm, drizzle-kit in packages/backend (using bun:sqlite instead of better-sqlite3)
- [x] 4.2 Create packages/backend/src/db/schema.ts with Drizzle table definitions for all 7 tables (papers, tags, paper_tags, qa_entries, qa_results, service_executions, api_tokens)
- [x] 4.3 Create drizzle.config.ts for drizzle-kit
- [x] 4.4 Generate initial migration with drizzle-kit
- [x] 4.5 Create packages/backend/src/db/index.ts — initialize bun:sqlite connection, enable WAL mode, run migrations, export drizzle db instance
- [x] 4.6 Create data/ directory with .gitkeep, add data/*.db to .gitignore
- [ ] 4.7 Write unit test verifying all tables are created and basic CRUD works

## 5. Auth Middleware

- [x] 5.1 Implemented manual Basic Auth (replaced @fastify/basic-auth due to Bun compatibility)
- [x] 5.2 Create packages/backend/src/auth/basic_auth.ts — validates against config.yml auth.users
- [x] 5.3 Create packages/backend/src/auth/token_auth.ts — Fastify preHandler hook that validates Bearer Token against api_tokens table
- [ ] 5.4 Write unit tests for both auth middlewares (valid, invalid, missing credentials/token, revoked token)

## 6. Fastify Server Setup

- [x] 6.1 Install fastify and @fastify/cors in packages/backend
- [x] 6.2 Create packages/backend/src/index.ts — initialize Fastify, register auth hooks, set up route prefixes (/api/* with Basic Auth, /external-api/* with Token Auth)
- [x] 6.3 Create stub Internal API routes: GET /api/health, POST /api/settings/tokens, GET /api/settings/tokens, DELETE /api/settings/tokens/:id
- [x] 6.4 Implement token issuance (POST /api/settings/tokens) — generate random token, store in api_tokens
- [x] 6.5 Implement token listing (GET /api/settings/tokens) — return tokens with masked values
- [x] 6.6 Implement token revocation (DELETE /api/settings/tokens/:id) — set revoked_at
- [ ] 6.7 Write unit tests for token CRUD endpoints

## 7. Database Backup

- [x] 7.1 Create packages/backend/src/db/backup.ts — backup function using file copy (bun:sqlite compatible)
- [x] 7.2 Implement retention cleanup — scan backup dir, delete files older than retention_days
- [x] 7.3 Implement daily scheduler — check on startup, then setInterval for 24h
- [x] 7.4 Create data/backups/ directory with .gitkeep
- [ ] 7.5 Write unit test for backup creation and retention cleanup logic

## 8. Frontend Scaffold

- [x] 8.1 Set up Vue Router with route stubs: / (PaperList), /papers/:id (PaperDetail), /qa (QAPage), /services (ServiceDashboard), /settings (Settings)
- [x] 8.2 Set up Pinia store stubs (papers, settings)
- [x] 8.3 Create App.vue with navigation bar (论文管理, Q&A, 服务管理, 设置)
- [x] 8.4 Create placeholder view components for each route
- [x] 8.5 Configure Vite proxy to forward /api and /external-api to backend during development

## 9. Integration Verification

- [x] 9.1 Add root package.json scripts: `dev` (start backend + frontend), `build`, `test`
- [x] 9.2 Verify full startup: backend on port 3000, frontend on Vite dev server, proxy works
- [x] 9.3 Verify Basic Auth: accessing API without credentials returns 401, with credentials succeeds
- [x] 9.4 Verify database: tables created, migrations run on startup, paper CRUD works
