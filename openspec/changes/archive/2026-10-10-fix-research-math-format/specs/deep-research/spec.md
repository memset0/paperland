## MODIFIED Requirements

### Requirement: Round input assembly
Each round's model input SHALL consist of the configured research system prompt and a user message using XML-style tags, containing in order: `<topic>`; `<seed>` when present; `<history>` with prior steps — each agent round's user text and its `changes` note, and each title edit described as such (most recent steps in full, older ones truncated to stay within `research.history_char_budget`); `<current_version>` holding the current report in `<report>` and the current list in `<paper_list>`; and `<request>` with this round's user text. In `<paper_list>`, every section SHALL carry its title and description, every paper SHALL carry its `s2_id`, an `in_library="paperland://paper/<id>"` attribute when the paper is in the library, the Semantic Scholar metadata fetched by the system (title, authors, year, venue, arXiv id, citation count, TLDR, and abstract truncated to `research.abstract_char_limit` characters) and its current comment, papers whose id did not resolve SHALL be marked `verified="false"`, and every link SHALL carry its URL, citation, and comment. The prompt SHALL state that this metadata is provided by the system for reference and SHALL instruct the agent to output only `s2_id` and `comment` for papers, never repeating title, authors, abstract, or other metadata; to obtain each paper's S2 paperId from its semanticscholar.org URL via web search; to cite non-paper sources as link items with BibTeX `@misc`-style citations; to always output both the full report and the full paper list; to re-check and correct (or remove) papers marked `verified="false"`; to keep owner-edited titles unless the user asks otherwise; to write all math in LaTeX using `$...$` for inline math and `$$...$$` on its own lines for important equations, never `\(...\)` or `\[...\]`; to escape every backslash inside paperlist JSON strings (e.g. `\\frac`), since sequences such as `\f`, `\t`, `\n`, `\b`, and `\r` are otherwise silently decoded as JSON escapes; and to link papers marked `in_library` as `[📄 short title](paperland://paper/<id>)` using the given link. Web search SHALL be enabled for research rounds.

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
