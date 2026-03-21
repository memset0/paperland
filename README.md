# Paperland

[中文文档](README.zh_CN.md)

A self-hosted academic paper management system with AI-powered Q&A, automatic metadata enrichment, and Zotero integration.

## Features

- **Paper Management** — Add papers via arXiv ID, Semantic Scholar corpus ID, or manual entry. Automatic metadata fetching (title, authors, abstract) from multiple sources.
- **AI-Powered Q&A** — Ask template-based or free-form questions about papers using configurable LLM backends. Supports LaTeX math rendering.
- **PDF Viewer** — Built-in PDF viewer with dual-panel layout (PDF + paper info & Q&A).
- **Service Pipeline** — Pluggable service architecture with dependency graph scheduling, concurrency control, and rate limiting.
- **Zotero Integration** — Zotero 7 sidebar plugin for seamless paper sync, auto-detection of arXiv IDs, and tag synchronization.
- **Tag System** — Organize papers with tags, synced between Paperland and Zotero.
- **Responsive Design** — Desktop sidebar layout and mobile-friendly interface.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | [Bun](https://bun.sh) |
| Frontend | Vue 3 + Vite + Pinia + Tailwind CSS |
| Backend | Fastify + Drizzle ORM |
| Database | SQLite (WAL mode, daily backups) |
| Zotero Plugin | Bootstrap addon for Zotero 7+ |

## Prerequisites

- [Bun](https://bun.sh) v1.0+

## Quick Start

### 1. Install dependencies

```bash
bun install
```

### 2. Create configuration

```bash
cp config.example.yml config.yml
```

Edit `config.yml` to configure your LLM models, authentication, and other settings. See [Configuration](#configuration) for details.

### 3. Run the application

```bash
# Start both backend and frontend (run from project root)
bun run packages/backend/src/index.ts & bun run --filter '@paperland/frontend' dev
```

The application will be available at `http://localhost:5173`. All traffic goes through the Vite dev server, which proxies API requests to the backend on port 3000.

> **Important:** Always start the backend from the project root directory. The database path in `config.yml` is resolved relative to the working directory.

## Configuration

Paperland uses a single `config.yml` file as the source of truth. Copy `config.example.yml` to get started.

### Database

```yaml
database:
  type: sqlite
  path: ./data/paperland.db
  backup:
    enabled: true
    dir: ./data/backups
    retention_days: 30
```

### Authentication

```yaml
auth:
  enabled: false  # Set to true to require HTTP Basic Auth for /api/*
  users:
    - username: admin
      password: changeme
```

The external API (`/external-api/*`) uses Bearer token authentication. Tokens are managed in the Settings page.

### LLM Models

```yaml
models:
  default: gpt-4o
  available:
    - name: gpt-4o
      type: openai_api
      endpoint: https://api.openai.com/v1
      api_key_env: OPENAI_API_KEY
```

### Q&A Templates

Define template questions that can be batch-applied to papers:

```yaml
system_prompt: |
  Answer the following question based on the paper content: {PROMPT}

  ---

  {PAPER}

qa:
  - name: research-question
    prompt: "What problem does this paper try to solve?"
  - name: method
    prompt: "How does the paper solve the proposed research problem?"
  - name: summary
    prompt: "Summarize the main content of this paper."
```

### Services

Configure concurrency and rate limiting for each service:

```yaml
services:
  arxiv:
    max_concurrency: 3
    rate_limit_interval: 3
  semantic_scholar:
    max_concurrency: 5
    rate_limit_interval: 1
  pdf_parse:
    max_concurrency: 2
    method: nodejs  # or python
  qa:
    max_concurrency: 2
```

## Project Structure

```
paperland/
├── config.yml                 # Application configuration (gitignored)
├── config.example.yml         # Example configuration
├── data/                      # SQLite database, PDFs, backups
├── packages/
│   ├── shared/                # Shared TypeScript types
│   ├── backend/               # Fastify API server
│   │   └── src/
│   │       ├── api/           # Internal API routes (/api/*)
│   │       ├── external-api/  # External API routes (/external-api/*)
│   │       ├── services/      # Service implementations
│   │       └── db/            # Drizzle schema & migrations
│   ├── frontend/              # Vue 3 SPA
│   │   └── src/
│   │       ├── views/         # Page components
│   │       ├── components/    # Reusable UI components
│   │       ├── stores/        # Pinia state management
│   │       └── api/           # HTTP request wrappers
│   └── zotero-plugin/         # Zotero 7 sidebar addon
└── docs/                      # Architecture documentation
```

## Zotero Plugin

The Zotero plugin adds a sidebar panel that displays paper details and Q&A directly within Zotero 7.

### Setup

1. Build the plugin or install from release
2. In Zotero Preferences, configure:
   - **Host URL**: Your Paperland instance URL (e.g. `http://localhost:5173`)
   - **API Token**: Generated from Paperland Settings page
3. Select a paper in your Zotero library — the sidebar will automatically detect its arXiv ID and sync with Paperland

### Features

- Auto-detect arXiv IDs from Zotero item metadata
- One-click paper sync with automatic metadata fetching
- Tag synchronization between Zotero and Paperland
- Embedded paper detail view in sidebar

## API

Paperland exposes two API surfaces:

- **Internal API** (`/api/*`) — Used by the frontend. Protected by HTTP Basic Auth (if enabled).
- **External API** (`/external-api/v1/*`) — Used by the Zotero plugin and third-party integrations. Protected by Bearer token auth.

See [docs/external-api.md](docs/external-api.md) for the external API reference.

## Development

```bash
# Run backend only (port 3000)
bun run packages/backend/src/index.ts

# Run frontend only (port 5173)
bun run --filter '@paperland/frontend' dev

# Run backend tests
bun run --filter '@paperland/backend' test

# Generate Drizzle migration after schema changes
cd packages/backend && bunx drizzle-kit generate
```

## License

MIT
