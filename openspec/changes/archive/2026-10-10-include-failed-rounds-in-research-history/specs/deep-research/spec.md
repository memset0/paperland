## MODIFIED Requirements

### Requirement: Round input assembly
Each round's model input SHALL consist of the configured research system prompt and a user message using XML-style tags, containing in order: `<topic>`; `<seed>` when present; `<history>` with every prior step that is not still active, oldest first, each in its own `<step>` element carrying its index, kind and (for agent rounds) status — an agent round shows the user's message in its own `<user_message>` element (never truncated), its `changes` note when it finished (most recent notes in full; older notes are dropped to stay within `research.history_char_budget`), and, when it failed or was cancelled, a note that the round run after this user message failed or was cancelled and produced no new version; a title edit is described as such; `<current_version>` holding the current report in `<report>` and the current list in `<paper_list>`; and `<request>` with this round's user text. In `<paper_list>`, every section SHALL carry its title and description, every paper SHALL carry its `s2_id`, an `in_library="paperland://paper/<id>"` attribute when the paper is in the library, the Semantic Scholar metadata fetched by the system (title, authors, year, venue, arXiv id, citation count, TLDR, and abstract truncated to `research.abstract_char_limit` characters) and its current comment, papers whose id did not resolve SHALL be marked `verified="false"`, and every link SHALL carry its URL, citation, and comment. The prompt SHALL state that this metadata is provided by the system for reference and SHALL instruct the agent to output only `s2_id` and `comment` for papers, never repeating title, authors, abstract, or other metadata; to obtain each paper's S2 paperId from its semanticscholar.org URL via web search; to cite non-paper sources as link items with BibTeX `@misc`-style citations; to always output both the full report and the full paper list; to re-check and correct (or remove) papers marked `verified="false"`; to keep owner-edited titles unless the user asks otherwise; to write all math in LaTeX using `$...$` for inline math and `$$...$$` on its own lines for important equations, never `\(...\)` or `\[...\]`; to escape every backslash inside paperlist JSON strings (e.g. `\\frac`), since sequences such as `\f`, `\t`, `\n`, `\b`, and `\r` are otherwise silently decoded as JSON escapes; to link papers marked `in_library` as `[📄 short title](paperland://paper/<id>)` using the given link; and, when agent tools are available, to find S2 paperIds with the Semantic Scholar tools (`s2_match` for a known title, `s2_search` otherwise) rather than guessing, and to read papers that are in the Paperland library with the site tools (`search_papers`, `read_paper`). Web search SHALL be enabled for research rounds, and when `agent_tools.enabled` is true the round SHALL also have the Paperland MCP tools and the S2 literature-search skill.

#### Scenario: Second round sees the first version with metadata
- **WHEN** the owner submits a second round after round 1 produced a version containing paper P
- **THEN** the second round's input SHALL include round 1's report in `<report>`, and in `<paper_list>` paper P's `s2_id`, its fetched title, authors, year, arXiv id, TLDR, and truncated abstract, and its comment, followed by the new user text in `<request>`

#### Scenario: Long abstract truncated
- **WHEN** a paper's abstract is longer than `research.abstract_char_limit`
- **THEN** only the first `abstract_char_limit` characters SHALL be included, marked as truncated

#### Scenario: Library paper carries its in-app link
- **WHEN** the current list contains a verified paper whose S2 id matches library paper 42
- **THEN** its `<paper>` element in `<paper_list>` SHALL carry `in_library="paperland://paper/42"`, and papers not in the library SHALL carry no `in_library` attribute

#### Scenario: Prompt states the math and JSON escaping rules
- **WHEN** a research round's system prompt is assembled
- **THEN** it SHALL instruct `$...$` / `$$...$$` math, forbid `\(...\)` and `\[...\]`, and require backslashes in paperlist JSON strings to be escaped

#### Scenario: Prompt tells the agent to use the tools for paper ids
- **WHEN** a research round's system prompt is assembled
- **THEN** it SHALL instruct the agent to obtain S2 paperIds with `s2_match` / `s2_search` and to read library papers with `read_paper`

#### Scenario: Failed and cancelled rounds stay in the history
- **WHEN** round 2 failed, round 3 was cancelled, and the owner submits round 4
- **THEN** round 4's `<history>` SHALL contain rounds 2 and 3, each with its user message in a `<user_message>` element and a note that the round after that message failed (round 2) or was cancelled (round 3) without producing a version

#### Scenario: Earlier user messages are never cut
- **WHEN** the earlier user messages together exceed `research.history_char_budget`
- **THEN** every earlier user message SHALL still appear in full, only older `changes` notes SHALL be dropped, and the agent's earlier raw outputs SHALL NOT appear (the report and list are given in `<current_version>`)

