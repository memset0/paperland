## Why

Paperland currently manages papers but has no support for the downstream research workflow — turning paper readings into actionable research ideas. Researchers need a structured way to organize, review, and manage ideas that emerge from reading papers, with a local-first workspace model that integrates with AI agents while providing a web-based management interface.

## What Changes

- **New project system**: Local disk projects at `data/idea-forge/{project-name}/` with structured directories for papers and ideas, managed via backend API and synced to frontend
- **Paper dump capability**: Export papers from Paperland (filtered by tags) into workspace `papers/` directory with `metadata.json`, `full_text.md`, and placeholder for future `alphaxiv_summary.md`
- **Idea management backend**: API to read/write/move ideas stored as `ideas/{category}/{idea-name}/README.md` with YAML frontmatter (name, tags, scores, comments, summary, timestamps)
- **Idea Forge frontend**: New "Idea Forge" section with project listing page and per-project idea management in three view modes:
  - **Inbox mode**: Email-like split view — idea list on left, detail/editor on right with comment box and quick category buttons
  - **Kanban mode**: Drag-and-drop board with columns per category (unreviewed, under-review, validating, archived), horizontally scrollable
  - **List mode**: Flat table view of all ideas
- **Filtering & sorting**: All views support tag filtering and sort by created/updated time
- **Conflict-safe editing**: Content-hash based optimistic concurrency — detect local file changes before overwriting
- **Demo project**: `data/idea-forge/demo-project/` with `AGENTS.md` describing the project structure for downstream AI agents

## Capabilities

### New Capabilities

- `workspace-management`: Project creation/listing, idea-forge directory structure, paper dump from Paperland to local project (tag-filtered export with metadata.json + full_text.md)
- `idea-crud`: Read/write/move idea README.md files with YAML frontmatter parsing, content-hash conflict detection, category transitions, score/comment updates
- `idea-forge-frontend`: Three-mode idea management UI (inbox/kanban/list) with drag-and-drop, inline editing, auto-save, tag filtering, sort, and responsive layout

### Modified Capabilities

_(none — this is a new feature vertical with no changes to existing specs)_

## Impact

- **Backend**: New route group `/api/idea-forge/*` for project and idea operations; new filesystem utilities for reading/writing project directories
- **Frontend**: New router entries, new Vue pages (ProjectList, IdeaManager), new Pinia stores (ideaForge, ideas), new components (InboxView, KanbanBoard, ListView, IdeaDetail, ScoreInput, CategoryButtons)
- **Shared types**: New TypeScript interfaces for Project, Idea, IdeaFrontmatter
- **Filesystem**: Backend reads/writes files under `data/idea-forge/` directory (no DB schema changes needed)
- **Dependencies**: May need a YAML frontmatter parser (gray-matter or similar) for backend; drag-and-drop library for frontend kanban (vuedraggable or @vueuse/integrations)
- **Docs**: frontend-architecture.md and tech-stack.md need updates for new pages and workspace concept
