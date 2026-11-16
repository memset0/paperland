# Tasks

## 1. Measured inventory

- [x] 1.1 Add `packages/backend/src/testing/mcp_inventory.ts` that drives the real `/mcp` route on a temporary migrated database with seeded personal, agent and Topic tokens, printing initialize instructions, tools/list and per-tool and total character counts (markdown, or JSON with `--json`); verify it runs offline and leaves `data/paperland.db` unmodified (mtime/hash unchanged).

## 2. Review procedure

- [x] 2.1 Add `.claude/skills/mcp-review/SKILL.md` with the fixed checklist, finding id scheme, report template, comparison rules and the read-only boundary; add a pointer in `AGENTS.md`; verify the skill file loads and references the inventory command exactly as it runs.
- [x] 2.2 Document the inventory script and review reports in `docs/external-api.md` and `docs/tech-stack.md` (and state `docs/frontend-architecture.md` is unaffected); verify the documented command runs as written.

## 3. First review

- [x] 3.1 Run the procedure against the current server and save `docs/mcp-reviews/2026-11-16.md` covering every checklist dimension, including the doc2x not-ready fallback and ChatGPT connector compatibility; verify the report follows the template and every finding cites evidence.

## Workflow follow-up

- No runtime deployment applies (docs, script and agent workflow only); report that and ask whether to archive.
- Present candidate changes from the first review to the developer; the planned ChatGPT OAuth change is proposed separately.
