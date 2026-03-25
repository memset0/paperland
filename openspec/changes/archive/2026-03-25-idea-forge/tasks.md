## 1. Shared Types & Dependencies

- [x] 1.1 Add shared TypeScript interfaces in `packages/shared/`: `IdeaFrontmatter`, `Idea`, `IdeaDetail`, `IdeaForgeProject`, `DumpPapersRequest`, `DumpPapersResponse`
- [x] 1.2 Install `gray-matter` dependency in backend for YAML frontmatter parsing/serialization
- [x] 1.3 Install `vuedraggable` (or `vuedraggable@next`) dependency in frontend for kanban drag-and-drop

## 2. Backend — Idea Forge & File Utilities

- [x] 2.1 Create `packages/backend/src/idea-forge/utils.ts`: helper functions for sanitizing directory names, computing SHA-256 content hash, resolving idea-forge root path (`data/idea-forge/`), listing directories
- [x] 2.2 Create `packages/backend/src/idea-forge/frontmatter.ts`: parse/serialize idea README.md with gray-matter, handle defaults for missing fields, preserve unknown fields, flag parse errors
- [x] 2.3 Ensure `data/idea-forge/` directory auto-creation on backend startup (add to `packages/backend/src/index.ts`)

## 3. Backend — Project API

- [x] 3.1 Create `packages/backend/src/api/idea-forge.ts` route file with project endpoints: `GET /api/idea-forge/projects` (list), `POST /api/idea-forge/projects` (create with directory init)
- [x] 3.2 Implement project name validation (lowercase alphanumeric + hyphens + underscores) and 409 conflict for duplicate names
- [x] 3.3 Register idea-forge routes in `packages/backend/src/index.ts`

## 4. Backend — Idea CRUD API

- [x] 4.1 Add idea list endpoint: `GET /api/idea-forge/projects/:name/ideas` with query params for category filter, tag filter, sort field, sort order
- [x] 4.2 Add idea detail endpoint: `GET /api/idea-forge/projects/:name/ideas/:category/:ideaName` returning frontmatter, body, content_hash
- [x] 4.3 Add idea update endpoint: `PUT /api/idea-forge/projects/:name/ideas/:category/:ideaName` with content_hash conflict detection, auto-update `update_time`
- [x] 4.4 Add idea move endpoint: `PATCH /api/idea-forge/projects/:name/ideas/:category/:ideaName/move` with content_hash conflict detection, target_category validation, update_time update, and directory rename

## 5. Backend — Paper Dump API

- [x] 5.1 Add paper dump endpoint: `POST /api/idea-forge/projects/:name/dump-papers` with tag_ids filter
- [x] 5.2 Implement paper directory creation with sanitized names, `metadata.json` generation, and `full_text.md` content resolution using `content_priority` from config

## 6. Demo Project

- [x] 6.1 Create `data/idea-forge/demo-project/AGENTS.md` documenting the project structure, idea format (frontmatter schema), category system, and conventions for AI agents
- [x] 6.2 Create sample directory structure: `papers/`, `ideas/unreviewed/`, `ideas/under-review/`, `ideas/validating/`, `ideas/archived/` with a sample idea README.md

## 7. Frontend — Routing & Navigation

- [x] 7.1 Add routes to `packages/frontend/src/router/index.ts`: `/idea-forge` (ProjectList), `/idea-forge/:projectName` (IdeaManager)
- [x] 7.2 Add "Idea Forge" entry to the sidebar navigation component

## 8. Frontend — Pinia Store

- [x] 8.1 Create `packages/frontend/src/stores/idea-forge.ts`: fetch projects, create project, dump papers
- [x] 8.2 Create `packages/frontend/src/stores/ideas.ts`: fetch idea list, fetch idea detail, update idea, move idea, track content_hash, handle conflict errors

## 9. Frontend — Project List Page

- [x] 9.1 Create `packages/frontend/src/pages/ProjectList.vue`: project cards grid with name/counts, new project button with dialog, empty state

## 10. Frontend — Idea Manager Page & View Modes

- [x] 10.1 Create `packages/frontend/src/pages/IdeaManager.vue`: parent page with view mode toggle (inbox/kanban/list), filter bar (category multi-select, tag text filter), sort controls, paper dump button
- [x] 10.2 Create `packages/frontend/src/components/idea-forge/InboxView.vue`: left panel idea list + right panel idea detail, default filter to unreviewed
- [x] 10.3 Create `packages/frontend/src/components/idea-forge/IdeaDetail.vue`: fixed top section (comment textarea with auto-grow max 50vh, score input, llm_score display, category quick-switch buttons, save button) + scrollable bottom (editable summary, Markdown body editor, tags, timestamps)
- [x] 10.4 Create `packages/frontend/src/components/idea-forge/KanbanView.vue`: horizontal board with 4 category columns, drag-and-drop between columns via vuedraggable, min column width 280px, horizontal scroll
- [x] 10.5 Create `packages/frontend/src/components/idea-forge/ListView.vue`: flat table with sortable columns, row click navigates to inbox with idea selected
- [x] 10.6 Create `packages/frontend/src/components/idea-forge/ScoreInput.vue`: 0-5 star score selector, click to set, click again to clear

## 11. Frontend — Editing & Auto-save

- [x] 11.1 Implement auto-save with 2-second debounce on body/summary edits; immediate save on score/comment/category changes
- [x] 11.2 Implement Ctrl+S manual save handler
- [x] 11.3 Implement conflict detection: on 409 response, show error notification and "Reload" button replacing save button

## 12. Frontend — Paper Dump Dialog

- [x] 12.1 Create paper dump dialog component: tag selector (reuse existing TagSelector), confirm button, progress/success notification showing count of dumped papers

## 13. Documentation

- [x] 13.1 Update `docs/frontend-architecture.md` with Idea Forge pages, views, and components
- [x] 13.2 Update `docs/tech-stack.md` with idea-forge data directory and new dependencies
