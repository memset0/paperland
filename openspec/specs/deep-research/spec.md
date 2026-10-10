# deep-research Specification

## Purpose
Lets a user run an iterative literature search with an agent: each research session is a linear series of rounds in which the agent produces a full, sectioned, commented list of Semantic Scholar papers that the user refines with free-text feedback.

## Requirements

### Requirement: Research sessions
The system SHALL let an authenticated user create a research session with a research topic and a Codex model for the first round. A session MAY carry a seed snapshot. Creating a session SHALL immediately start its first round using the topic as the round's user text. The session's displayed title SHALL be the title of its current list version, falling back to a truncated topic until a list exists. Sessions SHALL be owned by their creator. The owner (and an admin) SHALL be able to delete a session; deleting SHALL remove all of its steps.

#### Scenario: Create from scratch
- **WHEN** a logged-in user creates a session with topic "efficient long-context attention" and model `codex-a`
- **THEN** a session owned by that user SHALL exist with one agent round whose user text is the topic, model `codex-a`, and status `queued`

#### Scenario: Title follows the list
- **WHEN** the current list version has title "Long-context attention survey"
- **THEN** the session SHALL be displayed with that title in the research list and detail pages

#### Scenario: Anonymous cannot create
- **WHEN** an anonymous client tries to create a session
- **THEN** the server SHALL respond with 401

### Requirement: Start research from a QA answer
Every QA Result the viewer can see SHALL offer a "Deep Research" action that opens session creation prefilled from that Result. The created session SHALL store a seed snapshot containing the source paper's id and title, the question, the answer text, and the source Result id at creation time. Later edits or deletion of the source QA SHALL NOT change the session or its seed.

#### Scenario: Seed is a snapshot
- **WHEN** a session is created from QA Result 42 and Result 42 is later deleted
- **THEN** the session SHALL still show and use the seed's question and answer text

### Requirement: Linear history of steps and versions
A session's history SHALL be a strictly ordered, non-branching sequence of steps. A step SHALL be either an agent round (user text + one model + agent output) or a title edit by the owner. Every step that yields a list SHALL create a new list version; all versions SHALL be kept and viewable. The owner SHALL be able to submit a new agent round (free text plus a model); when a round is active (`queued`, `awaiting_output`, or `streaming`) the message SHALL be queued instead (see "Queued messages") rather than rejected. Only the latest step, when it is an agent round, SHALL be retryable; retrying SHALL replace that round's output (the user MAY edit its text and model). The owner SHALL be able to cancel an active round. A new round's model SHALL default to the most recent agent round's model.

#### Scenario: Cannot submit while running
- **WHEN** the latest round is `streaming` and the owner submits a new message
- **THEN** no new round SHALL start and no step SHALL be created yet; the server SHALL respond 202 and store the message in the session's queue

#### Scenario: Retry replaces the latest round
- **WHEN** the owner retries the latest agent round with edited text
- **THEN** the number of steps SHALL be unchanged, and that round SHALL run again with the edited text

#### Scenario: Earlier steps are not retryable
- **WHEN** the owner tries to retry a step that is not the latest
- **THEN** the server SHALL respond with 409

### Requirement: Continue from a historical version
The owner SHALL be able to choose any earlier list version and continue from it. Doing so SHALL permanently delete every step after the step that produced that version, making it the current version; subsequent rounds and title edits SHALL build on it. Before deleting, the UI SHALL show a confirmation that states how many later versions and steps will be lost and that this cannot be undone; the action SHALL proceed only after the user confirms. The server SHALL reject the operation with 409 while any round in the session is active.

#### Scenario: Warning before truncation
- **WHEN** the owner views version 2 of 5 and chooses "Continue from this version"
- **THEN** the UI SHALL warn that versions 3–5 and their steps will be permanently deleted, and nothing SHALL change unless the owner confirms

#### Scenario: Truncation after confirmation
- **WHEN** the owner confirms continuing from version 2
- **THEN** all steps after the one that produced version 2 SHALL be deleted, version 2 SHALL be current, and the next submitted round SHALL receive version 2 as its current list

#### Scenario: Blocked while running
- **WHEN** a round is streaming and the owner tries to continue from an earlier version
- **THEN** the server SHALL respond with 409

### Requirement: Owner edits list and section titles
The owner SHALL be able to edit the current version's list title and section titles (but not its items, comments, or section order). Saving an edit SHALL create a new title-edit step whose list version is the current version with the edited titles; the items, comments, and report SHALL be copied unchanged. Editing while viewing a historical version SHALL first require continuing from that version (with the warning above). Edits SHALL be rejected with 409 while a round is active. Empty titles SHALL be rejected with 400.

#### Scenario: Rename a section
- **WHEN** the owner renames section "Sparse attention" to "Sparse & linear attention" in the current version
- **THEN** a new version SHALL exist with the renamed section and identical papers and comments, and it SHALL be current

#### Scenario: Papers are not editable
- **WHEN** a client submits a title edit that also changes papers or comments
- **THEN** the server SHALL respond with 400 and no version SHALL be created

### Requirement: Codex models only
Research rounds SHALL accept only models whose configured `type` is `codex`. The research UI SHALL offer only those models. If no Codex model is configured, creating a session SHALL be rejected with a clear error.

#### Scenario: Non-Codex model rejected
- **WHEN** a round is submitted with a model whose type is `openai_api`
- **THEN** the server SHALL respond with 400

### Requirement: Round output: report and paper list
The agent's answer for every round SHALL contain both a research report and a paper list. The report SHALL be complete Markdown (the full, updated report, not a diff) that MAY cite papers with `[short title](#cite:<s2_id>)` links, including papers not in the paper list, and MAY link non-paper sources with ordinary Markdown links. The paper list SHALL be exactly one fenced code block with info string `paperlist` containing JSON of the form `{"title": string, "changes"?: string, "sections": [{"title": string, "description"?: string, "items": [item]}]}`. Each item SHALL be either a paper `{"s2_id": string, "comment"?: string}`, where `s2_id` is the Semantic Scholar paperId taken from the paper's semanticscholar.org URL and the agent SHALL NOT supply title, authors, or other metadata (the backend obtains them from S2 by id; any such extra fields SHALL be ignored), or a non-paper link (e.g. a blog post) `{"url": string, "citation": {"title": string, "author"?: string[], "year"?: number, "month"?: string, "howpublished"?: string, "note"?: string}, "comment"?: string}` with an `http`/`https` URL, where `citation` follows BibTeX `@misc`-style fields written by the agent. An item SHALL NOT have both `s2_id` and `url`. `comment` values and section `description` values SHALL be Markdown and MAY cite papers with `[short title](#cite:<s2_id>)`. `changes` is an optional short note describing what this round changed. Each round SHALL output the complete list, not changes. If several `paperlist` blocks are present, the last one SHALL be used. The report SHALL be the answer with the `paperlist` block removed. A list version SHALL consist of the list title, the sections, and the report.

#### Scenario: Well-formed list
- **WHEN** a round's answer contains a report and one valid `paperlist` block with two sections
- **THEN** the new version SHALL contain the list title, those two sections in order, and the report (the answer without the block)

#### Scenario: Blog post item
- **WHEN** an item is `{"url": "https://example.com/blog/attention", "citation": {"title": "A blog on attention", "author": ["Jane Doe"], "year": 2024, "howpublished": "Example Blog"}, "comment": "Good intuition"}`
- **THEN** it SHALL be stored as a link item with that URL, citation, and comment, and no S2 lookup SHALL be made for it

#### Scenario: Paper metadata comes from S2
- **WHEN** a paper item is `{"s2_id": "<paperId>", "comment": "Key baseline"}`
- **THEN** its displayed title, authors, year, and venue SHALL come from the S2 paper cache, not from the agent

#### Scenario: Item with neither or both identifiers
- **WHEN** an item has neither `s2_id` nor `url`, or has both
- **THEN** the block SHALL be treated as invalid

### Requirement: List parsing and paper verification
When a round finishes, the system SHALL parse its `paperlist` block and verify paper items by normalizing each `s2_id` and resolving all of them through the S2 paper cache resolver (with fetching) in one batch. A paper whose id resolves SHALL be marked `verified`; a paper whose id does not resolve SHALL be kept with its id and comment and marked `unverified`. The system SHALL NOT attempt title-based matching. The same item MAY appear in several sections, each occurrence with its own comment; within a single section, duplicate items (same normalized S2 id, or same normalized URL for links) SHALL be kept only at their first occurrence.

#### Scenario: Unresolvable id kept as unverified
- **WHEN** a paper's `s2_id` is reported by S2 as not found
- **THEN** it SHALL remain in its section with its id, its comment, and verification `unverified`, displayed with the id and a Semantic Scholar link in place of a title

#### Scenario: Same paper in two sections
- **WHEN** the same paperId appears in two sections with different comments
- **THEN** both occurrences SHALL be kept, each with its own comment

#### Scenario: Duplicate within a section dropped
- **WHEN** the same paperId appears twice in one section
- **THEN** only the first occurrence in that section SHALL be kept

### Requirement: Automatic repair of an invalid output
When a finished round's output is invalid (no `paperlist` block, a block that is not valid JSON of the required shape, or an empty report), the system SHALL make exactly one automatic repair request to the same model within the same round, giving it the validation error and the original output. If only the paper list is invalid, the repair SHALL ask for a corrected `paperlist` block only and the original report SHALL be kept; if the report is missing, the repair SHALL ask for the full output (report and `paperlist`). During the repair the round SHALL remain active and the UI SHALL show a "Fixing paper list…" placeholder. A successful repair SHALL produce the round's version and SHALL be recorded on the step as repaired.

#### Scenario: Malformed JSON repaired
- **WHEN** a round's `paperlist` block is malformed and the repair returns a valid block
- **THEN** the round SHALL be `done` with a new version using the original report and the repaired list, marked as repaired

### Requirement: Missing report or list keeps the previous version
If a finished round's output is invalid and the automatic repair also fails (or itself errors), the round SHALL still be `done`, SHALL record a parse error, and SHALL NOT produce a new version; the session's current version (list and report) SHALL remain the previous one. The round's raw answer SHALL remain viewable in its timeline entry.

#### Scenario: Invalid JSON after repair
- **WHEN** a round's `paperlist` block contains malformed JSON and the repair output is also invalid
- **THEN** the round SHALL be `done` with a parse error, and the current version SHALL be unchanged

#### Scenario: List without report
- **WHEN** a round's answer consists only of a valid `paperlist` block and the repair still returns no report
- **THEN** the round SHALL be `done` with a parse error stating the report is missing, and no new version SHALL be created

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

### Requirement: Round runtime and streaming
Research rounds SHALL run in the background under a scheduler that honors `services.research` (`max_concurrency`, default 1, and `rate_limit_interval`) and SHALL follow the lifecycle `queued` → `awaiting_output` → `streaming` → `done` | `failed` | `cancelled`, persisting partial output while streaming. The system SHALL provide an SSE stream per round with `start`, `delta`, `done`, and `error` events, plus a `tool` event each time the agent starts or finishes a tool call (tool name, server, and status; not persisted), viewable by anyone allowed to view the session; disconnecting SHALL NOT cancel the round. While a round is active the research page SHALL show the agent's most recent tool call (e.g. "Calling s2_search…"). Rounds still active when the server restarts SHALL be marked `failed` on startup.

#### Scenario: Restart interrupts a round
- **WHEN** the server restarts while a round is `streaming`
- **THEN** after startup that round SHALL be `failed` with an interruption error

#### Scenario: Tool call progress is shown
- **WHEN** the agent of an active round calls `s2_search`
- **THEN** subscribers SHALL receive a `tool` event naming `s2_search`, and the research page SHALL show that call as the round's current activity

### Requirement: Paper list block hidden while streaming
While a round is streaming, the UI SHALL render the report progressively but SHALL NOT render the partial `paperlist` block; from the moment the block starts, it SHALL show a "Generating paper list…" placeholder instead. When the round finishes, the UI SHALL refresh the session's current version.

#### Scenario: Placeholder during generation
- **WHEN** the streamed answer has begun a ```` ```paperlist ```` block that is not yet complete
- **THEN** the round view SHALL show the "Generating paper list…" placeholder and no raw JSON

### Requirement: Research pages
The sidebar SHALL include a login-required "Research" entry linking to `/research`, a management page wrapped in `AppPage` that lists sessions (title, topic excerpt, round count, latest status, updated time) with a "New research" action and a `mine`/`all` scope selector. `/research/:id` SHALL be a detail page with its own layout showing the step timeline (agent rounds with user text, status, `changes` note, and list-change summary; title edits with what changed) and the selected version (report and paper list), plus an input for the next round with a Codex model selector for the owner.

#### Scenario: Navigate to research
- **WHEN** a logged-in user clicks "Research" in the sidebar
- **THEN** the `/research` page SHALL show their sessions and a "New research" action

### Requirement: Report display
The selected version's report SHALL be rendered as Markdown with the same citation behavior as Q&A answers: every `#cite:<id>` link SHALL be resolved through the S2 paper cache resolver and rendered as a citation chip with a hover/click card when it resolves (plain text otherwise), and a collapsed "References · N" list of the report's own citations SHALL appear below the report using the shared paper list component.

#### Scenario: Report cites a paper outside the list
- **WHEN** the report cites a resolvable paper that is not in the paper list
- **THEN** it SHALL render as a citation chip and appear in the report's References list

### Requirement: Paper list display and version comparison
The detail page SHALL render the selected version's paper list with the shared paper list component, showing section titles, each paper's resolved metadata, link items (formatted citation — title, authors, year, `howpublished` or site domain — opening the URL in a new tab), each item's comment rendered as Markdown with citation chips, and an indicator for `unverified` papers. The current (latest) version SHALL be shown by default; the user SHALL be able to open the version produced by any earlier step. Compared with the preceding version, per section (matched by section position and title), items new in a section SHALL be marked as added, and items removed from a section SHALL be listed in a collapsed "Removed" group.

#### Scenario: Compare versions
- **WHEN** version 3 adds paper C and drops paper A relative to version 2, and the user views version 3
- **THEN** paper C SHALL be marked as added and paper A SHALL appear under "Removed"

### Requirement: Research configuration
`config.yml` SHALL support a `research` block with `system_prompt` (name of a prompt file, default `research`) and `history_char_budget` (default 20000), `abstract_char_limit` (default 1500), and a `services.research` entry with `max_concurrency` and `rate_limit_interval`. Missing values SHALL fall back to these defaults.

#### Scenario: Defaults
- **WHEN** `config.yml` has no `research` block
- **THEN** the bundled `research` system prompt and a history budget of 20000 characters SHALL be used

### Requirement: Queued messages
While a round of a session is active, messages the owner submits SHALL be stored in the database as that session's queued messages (text, model, and enqueue order) and SHALL NOT start a round. When the active round ends — `done`, `failed`, or `cancelled` — and the session has queued messages, the system SHALL merge all of them, in enqueue order, into one user message joined only by newlines (`\n`), create one new agent round with that text, using the model of the most recently queued message, delete the queued messages, and start the round. The new round's creation time SHALL be the time it is created from the queue; enqueue times SHALL NOT be kept. After a server restart, sessions that have queued messages and no active round SHALL have their queue dispatched the same way during startup (after interrupted rounds are marked failed). The owner SHALL be able to remove a queued message before it is sent. Session detail SHALL include the queued messages for the owner; other viewers SHALL NOT see them. Deleting a session SHALL delete its queued messages.

#### Scenario: Two queued messages become one round
- **WHEN** round 3 is running and the owner submits "add benchmarks" and then "drop surveys"
- **THEN** after round 3 finishes, exactly one new round SHALL start whose user text is "add benchmarks\ndrop surveys" and the queue SHALL be empty

#### Scenario: Queue is sent after a failed or cancelled round
- **WHEN** the running round fails or is cancelled while one message is queued
- **THEN** a new round SHALL start with that message

#### Scenario: Removing a queued message
- **WHEN** the owner removes one of two queued messages before the round ends
- **THEN** only the remaining message SHALL be sent

#### Scenario: Others cannot queue or see the queue
- **WHEN** a viewer of a shared session who is not the owner submits a message or loads the session
- **THEN** the submission SHALL be rejected with 403 and the session detail SHALL contain no queued messages

#### Scenario: Restart dispatches the queue
- **WHEN** the server restarts while a round is running and a message is queued
- **THEN** on startup the round SHALL be marked failed and a new round SHALL start with the queued message
