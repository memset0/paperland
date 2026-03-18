## Why

Paperland is a new project with no existing code. Before any features can be built, we need the foundational infrastructure: monorepo structure, database schema, configuration loading, server with authentication, and shared type definitions. Every future change (services, Q&A, frontend pages, external API) depends on this foundation being in place.

## What Changes

- Scaffold Bun workspace monorepo with three packages: `frontend`, `backend`, `shared`
- Set up Drizzle ORM with SQLite and create all database tables (papers, tags, paper_tags, qa_entries, qa_results, service_executions, api_tokens)
- Implement `config.yml` loader with typed configuration (database, auth, services, models, content_priority)
- Set up Fastify server with HTTP Basic Auth middleware and Bearer Token middleware
- Create shared TypeScript type definitions for all data models
- Set up Vue 3 + Vite frontend scaffold with router and Pinia stores
- Configure SQLite daily backup with 30-day retention
- Create base `tsconfig` and project-level configuration files

## Capabilities

### New Capabilities
- `config-loading`: Loading and validating `config.yml` with typed access to database, auth, services, models, and content_priority settings
- `database-schema`: Drizzle ORM schema for all tables (papers, tags, paper_tags, qa_entries, qa_results, service_executions, api_tokens) with SQLite, designed for future PostgreSQL migration
- `auth`: HTTP Basic Auth for website access (credentials from config.yml) and Bearer Token auth for External API (tokens stored in database, issued/revoked via API)
- `database-backup`: Automated daily SQLite backup to `data/backups/` with configurable retention period

### Modified Capabilities

(none - greenfield project)

## Impact

- **New files**: ~30+ files across packages/frontend, packages/backend, packages/shared
- **Dependencies**: fastify, drizzle-orm, drizzle-kit, better-sqlite3, js-yaml, vue, vue-router, pinia, vite
- **Runtime**: Requires Bun installed
- **Data**: Creates `data/` directory for SQLite database and backups
