---
name: mcp-review
description: Review the design of Paperland's MCP server (/mcp tool surface) with a fixed checklist and save a dated, comparable report under docs/mcp-reviews/. Use when the developer asks to check the MCP design, tool redundancy, or MCP client compatibility. Read-only toward MCP behavior.
---

# MCP design review

Repeatable review of the `/mcp` tool surface. Every run uses the same measured input, checklist and report format so reports can be compared across dates.

**Boundary:** this procedure never edits MCP implementation (`packages/backend/src/api/mcp.ts`, `services/agent_tools.ts`, `services/topic_tools.ts`, skills under `agent_tools.skills_dir`, descriptions, schemas or permissions). The only file it writes is the report. Findings that need behavior changes become **candidate changes** that the developer selects; each selected candidate then goes through `/opsx:propose`.

## Steps

1. **Measure.** From the project root run the offline inventory (in-memory database, no network, production DB untouched):
   ```bash
   bun run packages/backend/src/testing/mcp_inventory.ts > <scratchpad>/mcp-inventory.md
   bun run packages/backend/src/testing/mcp_inventory.ts --json > <scratchpad>/mcp-inventory.json
   ```
   If it fails, report the failure and stop. Do not review from memory.
2. **Read the source of truth.** `packages/backend/src/api/mcp.ts`, `services/agent_tools.ts`, `services/topic_tools.ts`, the main specs `openspec/specs/research-agent-tools/spec.md`, `mcp-call-counts`, `mcp-pdf-pages`, and any active change under `openspec/changes/` that touches MCP (note them; do not review planned behavior as shipped).
3. **Read the previous report.** The newest file in `docs/mcp-reviews/` (by name). Carry over its finding ids.
4. **Evaluate every checklist dimension below.** Cite evidence (inventory numbers, tool names, file:line). A dimension with nothing to report still appears with "No findings".
5. **Write the report** to `docs/mcp-reviews/YYYY-MM-DD.md` (today's date; if it exists, use `YYYY-MM-DD-2.md`, `-3`, …) using the template below.
6. **Summarize to the developer** in chat: totals and their change, high-severity findings, and the candidate changes. Ask which candidates to propose. Do not start implementing.

## Checklist (fixed order, fixed id prefixes)

| Prefix | Dimension | What to check |
| --- | --- | --- |
| `RED` | Redundancy and merge candidates | Tools whose purpose overlaps (e.g. several S2 lookups, token management tools, metadata vs. full read), tools rarely useful to external clients, tools that could be a parameter of another. Weigh tool count against clarity: merge only if one tool stays easy to describe. |
| `DESC` | Description quality and size | Per-tool and total description chars from the inventory; initialize `instructions` size; descriptions that explain internals, repeat the instructions, lack "when to use", or mention client-specific paths (e.g. `$CODEX_HOME`) to clients that cannot use them. |
| `PARAM` | Parameters and schemas | Naming consistency (`paper_id` vs `id`, `url` vs `pdf_url`), missing `required`, missing `additionalProperties: false`, missing descriptions/enums/bounds, mutually exclusive params without explanation, types that differ between similar tools. |
| `PERM` | Token kinds and permissions | Which token kinds (personal / agent / topic, and any future OAuth grants) can call each tool; whether the list advertises tools a caller cannot use; separation of destructive operations (deleting papers, answers, tokens, sharing changes); least privilege for Topic tokens. |
| `ANN` | Annotations | `readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint` match real behavior (clients like ChatGPT use them to decide confirmation prompts). |
| `SIZE` | Response size and pagination | Default and max result sizes, truncation markers, `next_offset` style pagination being consistent, images only when requested. |
| `ERR` | Errors, not-ready states and fallbacks | Errors are actionable (`isError` with what to do next). Not-ready states give a usable fallback instead of a dead end — e.g. a paper whose doc2x parse is pending should offer rough PDF text or arXiv HTML and tell the model to check again on the user's next question. Background jobs report how to check progress. |
| `COMPAT` | Client compatibility | ChatGPT custom MCP connectors (remote HTTPS, OAuth or no auth — static bearer headers not configurable; tool annotations drive confirmations; structured content), Claude (Code / claude.ai connectors), Codex. Protocol versions, transport (stateless Streamable HTTP, no SSE), auth discovery (`WWW-Authenticate`, `/.well-known/oauth-protected-resource`). |

Severity: **high** (wrong behavior, security/permission problem, or blocks a target client), **medium** (wasted context, likely wrong tool choice, inconsistent contract), **low** (polish).

Ids: prefix + number, e.g. `RED-1`. A persisting finding keeps its id even if wording changes; new findings continue numbering after the highest id ever used for that prefix; resolved ids are never reused.

## Report template

```markdown
# MCP design review — YYYY-MM-DD

Previous report: <file or "none">. Code version: <package.json version> (<git short hash>).

## Inventory

| Metric | This review | Previous | Δ |
| --- | ---: | ---: | ---: |
| Tools | | | |
| tools/list JSON chars | | | |
| Description chars | | | |
| initialize instructions chars | | | |

Token kinds see identical lists: yes/no. Notes on the largest tools.

## Findings

### RED — Redundancy and merge candidates
- **RED-1** (medium, new|persisting) <one-line finding>. Evidence: … Recommendation: …

### DESC — Description quality and size
…(every dimension, in checklist order; "No findings" if empty)

## Comparison with previous report

| Id | Status (new / persisting / resolved) | Note |
| --- | --- | --- |

## Candidate changes

1. **<kebab-case-change-name>** — addresses <ids>. Scope in one or two sentences. Behavior change: yes/no.
```
