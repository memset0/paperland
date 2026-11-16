# Design

## Context

See proposal.md for motivation. The `/mcp` handler (`packages/backend/src/api/mcp.ts`) is a stateless JSON-RPC route. Its tool list comes from `AGENT_TOOLS` in `services/agent_tools.ts`, which includes `TOPIC_TOOLS`. Token kind (personal, agent, topic) affects which calls succeed, but `tools/list` returns the same list to every kind. `mcp.test.ts` already shows how to drive the route offline with Fastify `inject`, a temporary SQLite database and seeded tokens.

## Goals / Non-Goals

**Goals:** identical, measured input for each review; a checklist that does not drift between agents; reports that diff cleanly across dates.

**Non-Goals:** automatic scheduling (the developer triggers reviews); fixing findings within this change; live checks against ChatGPT or other real clients.

## Decisions

- **Project skill plus `AGENTS.md` pointer.** The procedure lives in `.claude/skills/mcp-review/SKILL.md`, so `/mcp-review` works in Claude Code, and `AGENTS.md` points other agents to the same file. Alternative considered: a markdown checklist in `docs/` only. That is not invocable by name and is easy to skip.
- **Inventory through the real route, not by importing `AGENT_TOOLS`.** `packages/backend/src/testing/mcp_inventory.ts` registers `mcpRoutes` on a throwaway Fastify app, points the database at a temporary migrated SQLite file, seeds one user with personal, agent and Topic tokens, and sends `initialize` and `tools/list` for each. This captures exactly what a client sees, including annotation defaults that are applied in the route. Output is markdown by default and JSON with `--json`. Character counts stand in for token cost; they are deterministic and good enough for comparing reviews.
- **Fixed report template inside the skill.** Finding ids use dimension prefixes (`RED-`, `DESC-`, `PARAM-`, `PERM-`, `ANN-`, `SIZE-`, `ERR-`, `COMPAT-`) plus a number. A persisting finding keeps its id, and new ids continue the numbering.
- **Reports are committed docs.** `docs/mcp-reviews/` holds history in Git, and the next review reads the latest file to do the comparison.

## Risks / Trade-offs

- [Seeding drifts from schema changes] → The script reuses Drizzle migrations and the same token helpers as `mcp.test.ts`, so schema changes flow through.
- [Agent judgement varies between runs] → The fixed checklist, measured inventory and required comparison section limit the variation. Severity labels are coarse (high / medium / low).
- [Importing the backend loads config] → The script loads `config.yml` read-only for limits, the same way the tests do. It never opens `data/paperland.db`.
