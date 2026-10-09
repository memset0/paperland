## Purpose

Lets readers review, in one place, the Semantic Scholar papers a Q&A answer cites, using a reusable paper-list component that later features (such as research paper lists) also render with.

## ADDED Requirements

### Requirement: Per-answer citation list
Every QA Result whose status is `done` and whose answer contains at least one valid `#cite:<id>` link SHALL show a "References · N" list below the answer, where N is the number of distinct cited papers. The list SHALL contain only the papers cited by that Result's own answer, de-duplicated by normalized id, in order of first appearance. The list SHALL be collapsed by default and expandable by the user. Results that are not `done`, or whose answer has no valid `#cite:` link, SHALL NOT show the list.

#### Scenario: Answer with repeated citations
- **WHEN** a done answer cites paper A, then paper B, then paper A again
- **THEN** the list header SHALL read "References · 2" and, when expanded, list A then B

#### Scenario: Each tab shows its own citations
- **WHEN** an entry has two Results from different models citing different papers
- **THEN** each Result's list SHALL contain only the papers cited in that Result

#### Scenario: Streaming answer shows no list
- **WHEN** a Result is still streaming
- **THEN** no citation list SHALL be shown for it

### Requirement: Citation row content
Each row SHALL show the paper title (falling back to the answer's link text when metadata is unavailable), up to three authors followed by "et al." when there are more, year and venue, and citation count when known. A row whose paper is in the library SHALL show an "In library" indicator that navigates to the in-app paper page. Every row with a known id SHALL offer a link that opens the paper's Semantic Scholar page in a new tab. Rows SHALL indicate loading while resolving, and SHALL indicate "Not found" or "Unavailable" for ids the resolver reports as `not_found` or `unavailable`.

#### Scenario: Paper in library
- **WHEN** a cited paper resolves with a `library_paper_id`
- **THEN** its row SHALL show "In library" linking to `/papers/<library_paper_id>`

#### Scenario: Unresolvable id
- **WHEN** a cited id resolves as `not_found`
- **THEN** its row SHALL show the answer's link text with a "Not found" indicator and the Semantic Scholar link

### Requirement: No library import from the citation list
The citation list SHALL NOT offer actions that add papers to the library, neither for all listed papers at once nor for an individual paper.

#### Scenario: No import controls
- **WHEN** a user expands a citation list
- **THEN** no "import", "add all", or "add to library" control SHALL be present

### Requirement: Batched client-side resolution
The frontend SHALL resolve cited ids through `POST /api/s2/papers/resolve`, coalescing ids requested by multiple components within the same tick into one request (respecting the server's per-request maximum by splitting), and SHALL cache results per id for the page session so that the same id is not requested again.

#### Scenario: Many answers on one page
- **WHEN** a page shows several done answers whose citation lists and chips need 40 distinct ids
- **THEN** the frontend SHALL issue a single resolve request for them (or the minimum number of requests allowed by the per-request maximum)

### Requirement: Reusable paper list component
The paper list used for citations SHALL be a reusable component that accepts an ordered list of items (each with an S2 id and optional fallback text and optional comment) and optional sections (each with a title and its items). When sections are given it SHALL render each section's title above its items; when an item has a comment it SHALL render the comment under the row.

#### Scenario: Plain citation usage
- **WHEN** the component is given items without sections or comments
- **THEN** it SHALL render a flat list of rows without section headings or comment text

#### Scenario: Sectioned usage with comments
- **WHEN** the component is given two sections whose items carry comments
- **THEN** it SHALL render both section titles, each followed by its rows, with each comment shown under its row

### Requirement: Citation chips resolve through the unified S2 resolver
In Markdown rendered in Q&A-answer mode, every `#cite:<id>` link SHALL be resolved through the S2 paper resolver, independent of which paper (if any) the content belongs to; the paper's stored references SHALL NOT be consulted. A link whose id resolves (status `resolved`) SHALL render as a citation chip whose card shows the resolved title, authors, year, venue, the in-library link when applicable, and the Semantic Scholar link. A link that does not resolve SHALL remain plain text.

#### Scenario: Resolvable id becomes a chip
- **WHEN** an answer cites an id that the resolver reports as `resolved`
- **THEN** it SHALL render as a chip, and hovering or clicking it SHALL show a card with the resolved metadata

#### Scenario: No dependency on the owning paper
- **WHEN** Markdown in Q&A-answer mode is rendered without any paper context (e.g. a research report)
- **THEN** its `#cite:` links SHALL still resolve and render as chips

#### Scenario: Unresolvable id stays plain text
- **WHEN** an answer cites an id that resolves as `not_found` or `unavailable`
- **THEN** it SHALL render as plain text
