## MODIFIED Requirements

### Requirement: QA feed panel structure
Each QA entry SHALL be rendered as a paper-title/time header line ABOVE the card, plus a shadcn-vue `Card` below it whose expand/collapse is driven by `Collapsible` (`CollapsibleTrigger` header, `CollapsibleContent` body) — it SHALL NOT use ad-hoc `v-if`/manual-toggle markup for collapse. The above-card line SHALL show the paper title (as a clickable link to `/papers/:id`, allowed to use the full line width — not truncated to a narrow fixed width) on the left and the creation time right-aligned. When the feed is viewed in the all-users scope, the above-card line SHALL also show the asker's username (the entry's `username`) so entries by different users are distinguishable; when viewing the own-entries scope, or when no `username` is present, the username SHALL be omitted. The card header SHALL use a primary row containing a labeled status indicator, a bold question preview of up to three lines, and an expand/collapse chevron. A separate wrapping metadata row SHALL contain answer/model information and independent link, background, input, and reading controls. The expanded header SHALL show the full question. Interactive metadata controls SHALL NOT be nested inside the expand/collapse trigger. A `Separator` SHALL divide the header from the body. The card body SHALL be collapsed by default.

#### Scenario: Panel built from shadcn primitives
- **WHEN** a QA entry renders
- **THEN** it SHALL be an above-card paper/time line plus a shadcn `Card` using `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent` for expand/collapse, with a `Separator` between the card header and body

#### Scenario: Paper title and time sit above the card
- **WHEN** a QA entry for paper "Attention Is All You Need" is displayed
- **THEN** the paper title SHALL appear as a link ABOVE the card (left-aligned, using the full available width), with the creation time right-aligned on the same line, and SHALL NOT be rendered inside the card

#### Scenario: Asker username shown in all-users scope
- **WHEN** the feed is viewed in the all-users scope and a QA entry has a `username`
- **THEN** the above-card line SHALL display that username as the entry's asker

#### Scenario: Asker username omitted in own scope
- **WHEN** the feed is viewed in the own-entries scope (or the entry has no `username`)
- **THEN** the above-card line SHALL NOT display an asker username

#### Scenario: Card header content
- **WHEN** a QA entry with question "What is the main contribution?" is displayed
- **THEN** the card header SHALL show a status indicator, the question text as a bold primary line, and an expand/collapse chevron, with a `Badge` indicating the number of answers (or the single model name) on a separate metadata row

#### Scenario: Status indicator is labeled
- **WHEN** a card shows its done / running / failed status icon
- **THEN** the icon SHALL be wrapped in a `Tooltip` whose content names the status

#### Scenario: Panel default state
- **WHEN** the /qa page loads
- **THEN** all QA entry cards SHALL be collapsed (body hidden)

#### Scenario: Panel expand/collapse
- **WHEN** a user clicks on a collapsed card header
- **THEN** the `Collapsible` SHALL expand the body to show the full QA results
- **WHEN** a user clicks on an expanded card header
- **THEN** the body SHALL collapse

#### Scenario: Paper link is independent of the card
- **WHEN** a user clicks the paper title link above a card
- **THEN** the app SHALL navigate to the paper detail page WITHOUT toggling the card's expand/collapse state (the link is outside the card)

#### Scenario: Long question on a narrow screen
- **WHEN** a long question is displayed at a 375px viewport width
- **THEN** its preview SHALL occupy up to three readable lines without being squeezed by metadata, the full question SHALL be visible when expanded, and the controls SHALL wrap without horizontal page overflow

#### Scenario: Metadata controls do not toggle the answer
- **WHEN** a viewer activates the QA link or background picker
- **THEN** that action SHALL work independently without expanding or collapsing the card

#### Scenario: Keyboard expansion
- **WHEN** a viewer focuses the question trigger and presses Enter or Space
- **THEN** the card SHALL toggle exactly once and expose its expanded state to assistive technology

## ADDED Requirements

### Requirement: Distinct feed and highlight scopes
The Q&A feed SHALL distinguish the question scope selector from the highlight scope selector using visible context labels. Both selectors and refresh SHALL remain reachable without horizontal page scrolling on phone screens. The question scope SHALL remain in the page header.

#### Scenario: Phone toolbar
- **WHEN** an authenticated viewer opens the feed at 375px wide
- **THEN** Questions Mine / All and refresh SHALL fit in the header and Highlights Mine / All SHALL appear in a separate toolbar

### Requirement: Feed presentation states
The feed SHALL show a question count, clear pagination labels, loading placeholders matching the card layout, and a helpful empty state linking to the paper library. All presentation SHALL use the application's light/dark theme and English UI labels.

#### Scenario: Empty feed
- **WHEN** the selected scope contains no questions
- **THEN** the feed SHALL explain how to ask a question and offer a link to the paper library

#### Scenario: Loading and paging
- **WHEN** a feed page loads or the viewer changes page
- **THEN** the feed SHALL show card-shaped skeletons while loading and labeled previous/next controls with the current and total page numbers when pagination is needed
