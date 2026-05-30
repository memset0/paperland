# notes-walkthrough Specification

## Purpose

Render a paper's small-notes tree as a single continuous, reading-oriented "walkthrough" document in the paper-detail left panel. The notes are concatenated in mind-map traversal order, their headings are re-leveled by tree depth and auto-numbered to form a coherent outline, clicking a heading opens the underlying note's editor, text-highlighting is disabled to keep a clean reading surface, and the document live-updates as the notes or mind-map structure change.

## Requirements

### Requirement: Walkthrough document assembled from the notes tree
The system SHALL assemble the small notes of a (user, paper) into a single continuous reading view by traversing the mind-map tree depth-first. Siblings SHALL be visited in `sort_order`. For each visited note the system SHALL emit, in order: a heading derived from the note's `title`, the note's `body`, then the sections of its children. The root note SHALL NOT emit a heading of its own; its `body` (if any) SHALL be emitted as introductory content and its children SHALL form the top level of the document.

#### Scenario: Notes concatenated in mind-map order
- **WHEN** a paper has a notes tree with multiple branches
- **THEN** the walkthrough SHALL contain every note's content in depth-first order with siblings ordered by `sort_order`, each note's own body appearing before its children's sections

#### Scenario: Root contributes content but not a heading
- **WHEN** the walkthrough is assembled
- **THEN** the root note SHALL NOT produce a heading, while its direct children SHALL each begin a top-level section

### Requirement: Depth-based heading re-leveling
Note-title headings in the assembled document SHALL be re-leveled by mind-map depth: the top level of the tree (the root's direct children) SHALL use H2, and each additional level of depth SHALL increase the heading level by one (depth 1 → H2, depth 2 → H3, and so on). Headings the user typed inside a note `body` SHALL be re-leveled to nest *under* that note's title heading: the body's shallowest authored heading SHALL sit one level below the note, and deeper authored levels SHALL keep their relative nesting. Heading levels SHALL be clamped to H6.

#### Scenario: Top level uses H2
- **WHEN** a note is a direct child of the root
- **THEN** its title heading in the walkthrough SHALL be rendered at level H2

#### Scenario: Deeper levels increase by one
- **WHEN** a note is nested N levels below the root's direct children
- **THEN** its title heading SHALL be rendered at level H(2 + N)

#### Scenario: Body headings nest under their note
- **WHEN** a note `body` itself contains Markdown headings
- **THEN** those headings SHALL be re-leveled to render below the note's own title heading (the note-title level is still determined solely by mind-map depth), preserving the body headings' relative nesting

### Requirement: Untitled and empty notes in the document
A note without a title SHALL still emit a heading using a stable fallback label (e.g. "(untitled)") so the document structure mirrors the tree. A note with an empty `body` SHALL emit only its heading (no body content) and still recurse into its children.

#### Scenario: Untitled note keeps a heading
- **WHEN** a note has no title
- **THEN** the walkthrough SHALL still emit a heading at the note's depth so its position and children remain visible

#### Scenario: Empty-body note emits heading only
- **WHEN** a note has an empty body
- **THEN** the walkthrough SHALL emit its heading and no body text, then continue with its children

### Requirement: Render walkthrough in the left panel
The walkthrough SHALL be rendered within the paper detail left panel, scrollable independently of the rest of the page. Each note's heading SHALL be rendered by the view itself (carrying its section number and a click affordance, see below), and each note's `body` SHALL be rendered as Markdown using the project's Markdown renderer with math support.

As a reading-oriented view, the walkthrough SHALL render its body text at a compact reading size and its headings SHALL be visibly larger than the body, with a consistent decreasing scale across heading depths (including levels deeper than H3). Heading sizes SHALL be set in absolute units so they stay constant regardless of the body size. This sizing SHALL be scoped to the walkthrough view and SHALL NOT change the Markdown sizing used elsewhere (e.g. Q&A answers, paper content).

#### Scenario: Walkthrough renders rich Markdown
- **WHEN** the walkthrough mode is shown
- **THEN** each note's body SHALL be rendered as formatted Markdown (lists, math, code, anchor links, etc.) rather than raw text

#### Scenario: Reading-oriented sizing
- **WHEN** the walkthrough is displayed
- **THEN** its body text SHALL be a compact reading size and its headings SHALL be larger than the body across heading depths, while Markdown rendered elsewhere keeps its normal sizes

### Requirement: Auto-numbered headings
Every heading in the walkthrough — both note-title headings and headings authored inside note bodies — SHALL be prefixed with a hierarchical section number reflecting only the walkthrough's heading hierarchy and order, independent of the notes' own titles. Numbering SHALL start at the top heading level (the root's direct children) and form dotted numbers with a trailing dot (e.g. `1.`, `1.2.`, `1.2.3.`). Body headings SHALL be numbered in document order together with the note's child notes (a note's own subsections and its child notes share one continuous outline). The root's heading-less intro SHALL NOT be numbered.

#### Scenario: Top-level numbering
- **WHEN** the root has direct child notes
- **THEN** they SHALL be numbered `1.`, `2.`, `3.`, … in `sort_order`

#### Scenario: Nested numbering with trailing dot
- **WHEN** a note is the 3rd child of the 2nd child of the 1st top-level note
- **THEN** its heading SHALL be numbered `1.2.3.` (with a trailing dot), independent of any note's title

#### Scenario: Body headings are numbered too
- **WHEN** a note's body contains Markdown headings
- **THEN** those headings SHALL also receive outline numbers, interleaved in document order with the note's child notes (e.g. a note `1.` whose body has a heading then has child notes → the body heading is `1.1.` and the first child note is `1.2.`)

### Requirement: Headings open the note editor
Because every walkthrough heading corresponds to a specific note, clicking a heading SHALL open that note's floating editor window (the same window model used by the mind-map), so the user can edit notes directly from the walkthrough. The heading SHALL present a visible click affordance (e.g. a hover cue and an edit icon).

#### Scenario: Click a heading to edit its note
- **WHEN** a user clicks a walkthrough heading
- **THEN** the system SHALL open the floating editor for that heading's note

#### Scenario: Heading shows it is interactive
- **WHEN** a user hovers a walkthrough heading
- **THEN** the heading SHALL indicate it is clickable (e.g. a hover cue and an edit icon)

### Requirement: No highlighting in the walkthrough
The walkthrough SHALL NOT offer text-highlighting: it SHALL NOT show the selection highlight toolbar, SHALL NOT render stored highlights, and SHALL NOT show the highlight click-menu. (The highlight model is keyed by content hash, which is incompatible with the walkthrough's dynamically assembled content.) Non-highlight Markdown interactions such as `paperland://` anchor links and KaTeX copy MAY still work.

#### Scenario: Selecting text shows no highlight toolbar
- **WHEN** a user selects text within the walkthrough
- **THEN** no highlight toolbar SHALL appear and no highlight SHALL be created

#### Scenario: Stored highlights are not rendered
- **WHEN** the walkthrough renders a note body that has highlights elsewhere
- **THEN** those highlights SHALL NOT be shown in the walkthrough

### Requirement: Live re-render on note changes
The walkthrough SHALL update automatically, without manual refresh, whenever a note's title or body is edited or whenever notes are reparented or reordered, reflecting the current tree state.

#### Scenario: Edit updates the walkthrough
- **WHEN** a user edits a note's title or body
- **THEN** the walkthrough document SHALL re-assemble and re-render to include the updated content

#### Scenario: Reorder updates the walkthrough
- **WHEN** a user reparents or reorders nodes in the mind-map
- **THEN** the walkthrough document SHALL re-assemble in the new order and re-render
