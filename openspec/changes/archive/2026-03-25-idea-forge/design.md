## Context

Paperland is a paper management platform with Fastify backend, Vue 3 frontend, and SQLite storage. Users currently manage papers, tags, QA, and services through a web UI. The missing piece is a structured workflow for turning paper readings into research ideas.

The Idea Forge feature introduces a **filesystem-based project model** — ideas and paper dumps live as files on disk under `data/idea-forge/{project-name}/`, not in the database. The web UI provides browsing, reviewing, and managing these ideas. This design keeps ideas portable (plain files, editable by AI agents or text editors) while providing a rich management interface.

## Goals / Non-Goals

**Goals:**
- Project management (create, list, browse projects under `data/idea-forge/`)
- Export papers from Paperland to project (tag-filtered, structured output)
- Read/edit/move ideas stored as Markdown files with YAML frontmatter
- Three-mode idea browsing UI (inbox, kanban, list)
- Conflict-safe file editing with content-hash validation
- Demo project with AGENTS.md for downstream AI agent use

**Non-Goals:**
- AlphaXiv summary download (spec placeholder only, no implementation)
- CLI tools for idea generation (designed later)
- AI agent integration for idea generation (user-driven, outside scope)
- Real-time collaboration / multi-user editing
- Database storage for ideas (filesystem is the source of truth)
- Full-text search across idea content

## Decisions

### 1. Filesystem-based storage, not database

**Decision**: Ideas and paper dumps are stored as plain files under `data/idea-forge/`, not in SQLite.

**Why**: Ideas need to be accessible to AI agents, text editors, and CLI tools running locally. Storing in the database would require sync mechanisms. Plain files are the universal interface.

**Alternative considered**: SQLite with file export/import — rejected because it adds complexity and the filesystem IS the source of truth in the user's workflow.

**Trade-off**: No full-text search, no relational queries. Acceptable because idea volumes per project are small (tens to hundreds, not thousands).

### 2. YAML frontmatter in README.md for idea metadata

**Decision**: Each idea's metadata (name, tags, scores, timestamps, summary, comment) lives in YAML frontmatter of `ideas/{category}/{idea-name}/README.md`.

**Why**: Keeps metadata co-located with content. Standard format parseable by many tools. AI agents can read/write it. The `gray-matter` npm package handles parsing/serialization.

**Frontmatter schema**:
```yaml
---
name: "Idea Display Name"
author: "gpt-5.4"    # "me" for human, model name for agents (e.g. "claude-opus-4.6", "gpt-5.4")
tags:
  - "reinforcement-learning"
  - "multi-agent"
create_time: "2026-03-25T14:30:00+09:00"
update_time: "2026-03-25T15:00:00+09:00"
my_score: 0      # 0-5, 0 = unrated
llm_score: 0     # 0-5, 0 = unrated
my_comment: ""
summary: "One-line summary of what this idea proposes"
---

# Idea Title

Content body here...
```

### 3. Category = directory location

**Decision**: An idea's category (unreviewed, under-review, validating, archived) is determined by which directory it lives in: `ideas/{category}/{idea-name}/`.

**Why**: Moving categories = moving directories. Simple, visible, works with any file manager or CLI. No metadata/directory mismatch possible.

**Categories**: `unreviewed`, `under-review`, `validating`, `archived`

### 4. Content-hash based conflict detection

**Decision**: When the frontend opens an idea, the backend returns a `content_hash` (SHA-256 of the raw file bytes). On save, the frontend sends back this hash. The backend compares it against the current file — if mismatched, reject the write with a 409 Conflict response. This applies to both content updates AND category moves (since moves also modify `update_time` in frontmatter).

**Why**: Prevents overwriting local edits made by agents or text editors between page load and save. Simple, stateless, no locking needed.

**Alternative considered**: File modification timestamp — rejected because filesystem time resolution varies and clock skew between processes is possible. Hash is deterministic.

### 5. data/idea-forge/ directory under project data

**Decision**: Projects live at `{project-root}/data/idea-forge/{project-name}/`.

**Why**: Co-located with other Paperland data (database, backups). The `data/idea-forge/` directory is gitignored by default (user-specific local data), with an exception for `demo-project/` which is tracked in git.

**Structure**:
```
data/idea-forge/
  {project-name}/
    AGENTS.md           # Instructions for AI agents
    papers/
      {paper-title}/
        metadata.json   # Paper metadata (title, authors, abstract, etc.)
        full_text.md    # Full paper content
        alphaxiv_summary.md  # (future) AI summary from AlphaXiv
    ideas/
      unreviewed/
        {idea-name}/
          README.md     # Idea content with YAML frontmatter
      under-review/
        ...
      validating/
        ...
      archived/
        ...
```

### 6. API route structure

**Decision**: New routes under `/api/idea-forge/`:
- `GET /api/idea-forge/projects` — list all projects
- `POST /api/idea-forge/projects` — create project (init directory structure)
- `GET /api/idea-forge/projects/:name/ideas` — list ideas (with filter/sort query params)
- `GET /api/idea-forge/projects/:name/ideas/:category/:ideaName` — get idea detail + content_hash
- `PUT /api/idea-forge/projects/:name/ideas/:category/:ideaName` — update idea (with content_hash for conflict check)
- `PATCH /api/idea-forge/projects/:name/ideas/:category/:ideaName/move` — move idea to different category (with content_hash)
- `POST /api/idea-forge/projects/:name/dump-papers` — export papers by tag filter to project

**Why**: Follows existing Paperland API patterns. RESTful, snake_case responses.

### 7. Frontend routing and navigation

**Decision**: New routes:
- `/idea-forge` — Project list page
- `/idea-forge/:projectName` — Idea management page (with `?view=inbox|kanban|list` query param)

Add "Idea Forge" to the main navigation sidebar.

**Why**: Clean URL structure. View mode in query param allows bookmarking specific views.

### 8. Paper dump format

**Decision**: `metadata.json` contains a formatted subset of paper data:
```json
{
  "id": 123,
  "title": "Paper Title",
  "authors": ["Author A", "Author B"],
  "abstract": "...",
  "arxiv_id": "2401.12345",
  "corpus_id": "12345678",
  "link": "https://...",
  "tags": ["tag1", "tag2"],
  "created_at": "2026-01-15T...",
  "updated_at": "2026-03-20T..."
}
```

`full_text.md` contains the resolved paper content (following content_priority order from config).

**Why**: Clean, agent-readable format. JSON for structured metadata, Markdown for content.

### 9. Frontend drag-and-drop for Kanban

**Decision**: Use `vuedraggable` (Vue 3 compatible, wraps SortableJS) for kanban drag-and-drop.

**Why**: Well-maintained, Vue 3 native, handles the drag UX. On drop, trigger a `PATCH /move` API call.

**Alternative considered**: Native HTML5 drag-and-drop — rejected due to poor mobile support and more boilerplate.

### 10. Auto-save with debounce

**Decision**: Content editing auto-saves with 2-second debounce after last keystroke. Manual save via Ctrl+S or save button also available. Score/comment/category changes save immediately.

**Why**: Balances responsiveness with avoiding excessive writes. Immediate save for discrete actions (score, category) since they're single operations.

## Risks / Trade-offs

**[Risk] Large project directories slow down listing** → Mitigation: Ideas are listed by reading directory entries + parsing frontmatter only (not full content). For projects with hundreds of ideas, this should still be fast. Can add caching later if needed.

**[Risk] Concurrent agent + web edits cause conflicts** → Mitigation: Content-hash check prevents silent overwrites. Frontend shows clear error message and offers to reload. Local agent edits always win (per user's design).

**[Risk] Frontmatter parsing errors from malformed agent output** → Mitigation: Backend uses `gray-matter` with try/catch. If frontmatter is unparseable, return the idea with empty metadata and flag `parse_error: true` so the frontend can show a warning.

**[Risk] data/idea-forge/ directory doesn't exist on first run** → Mitigation: Backend creates `data/idea-forge/` on startup if it doesn't exist. Project creation initializes the full directory structure.

**[Risk] Moving idea directories across categories fails mid-operation** → Mitigation: Use `fs.rename()` which is atomic on the same filesystem. Since all data is on the same volume, this is safe.
