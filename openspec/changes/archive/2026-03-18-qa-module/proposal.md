## Why

Q&A is a core feature — users ask questions about papers using LLMs. Supports template Q&A (predefined prompts from templates/ directory) and free Q&A (user-typed questions). Results are stored with model name and timestamp, supporting multiple results per entry.

## What Changes

- Backend: QA API endpoints (create entry, submit question, list entries/results, regenerate)
- Backend: QA service (pure service) calling OpenAI-compatible API or CLI
- Backend: Template loading from templates/ directory
- Frontend: Q&A section in paper detail + standalone Q&A page
- Create example templates (abstract.md, method.md, experiment.md)

## Capabilities

### New Capabilities
- `qa-api`: Backend API for template and free Q&A — create entries, submit questions, list results, regenerate
- `qa-service`: Pure service calling LLM (OpenAI API / Claude CLI / Codex CLI) with paper content as context
- `qa-templates`: Load prompt templates from templates/ directory, one-click generate all, prevent duplicate submissions

### Modified Capabilities
(none)

## Impact

- **New files**: `packages/backend/src/api/qa.ts`, `packages/backend/src/services/qa_service.ts`, `packages/backend/src/services/template_loader.ts`, `templates/*.md`
- **Modified**: `packages/backend/src/index.ts`, frontend views
