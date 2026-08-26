# qa-display-split Specification

## Purpose
The paper detail page Q&A area renders Preset Q&A and User Q&A as separate, independently-controlled cards.
## Requirements
### Requirement: Preset QA and User QA are rendered in separate cards
The QAList component SHALL render two independent card containers: one for preset QA entries (config-ordered) and one for user QA entries (newest-first). Each card SHALL have its own header with title and expand/collapse-all controls.

#### Scenario: Both template and free QA exist
- **WHEN** the paper has both preset QA entries and user QA entries
- **THEN** two separate cards are displayed: "Preset Q&A" card first, "User Q&A" card second

#### Scenario: Only template QA exists
- **WHEN** the paper has preset QA entries but no user QA entries
- **THEN** only the Preset Q&A card is displayed

#### Scenario: Only free QA exists
- **WHEN** the paper has user QA entries but no preset QA entries
- **THEN** only the User Q&A card is displayed

### Requirement: Card ordering on paper detail page
The paper detail page SHALL display content cards in this order: Kimi summary (if available) → Preset Q&A → User Q&A.

#### Scenario: All three cards present
- **WHEN** the paper has Kimi summary, preset QA, and user QA
- **THEN** cards appear in order: Kimi summary, Preset Q&A, User Q&A

### Requirement: All QA questions default to collapsed state
All QA question `<details>` elements SHALL render in collapsed (closed) state on page load, regardless of any previously stored localStorage state.

#### Scenario: Page load with existing localStorage state
- **WHEN** a user navigates to a paper detail page that has prior collapse state in localStorage
- **THEN** all QA questions are displayed in collapsed state

#### Scenario: User manually toggles a question
- **WHEN** a user clicks on a question title to expand it
- **THEN** that question expands to show full content; clicking again collapses it

### Requirement: Question title truncation in collapsed mode
In collapsed (summary) mode, question titles SHALL be truncated to a single line with ellipsis.

#### Scenario: Long question title in collapsed state
- **WHEN** a QA entry is collapsed and its title exceeds one line
- **THEN** the title is truncated with ellipsis (line-clamp-1)

### Requirement: Full content display in expanded mode
In expanded mode, QA answer content SHALL display with natural word-wrap allowing multiple lines. Line break characters in the content SHALL NOT be rendered as visual line breaks; content flows as a single paragraph that wraps based on container width.

#### Scenario: Expanded QA entry with long answer
- **WHEN** a QA entry is expanded
- **THEN** the full answer text is displayed, wrapping naturally at container width

### Requirement: Preset QA card has generate-all button
The Preset Q&A card header SHALL include the "一键生成" button when there are ungenerated preset questions, along with a polling status indicator.

#### Scenario: Some template questions not yet generated
- **WHEN** the Preset Q&A card is displayed and some preset questions have no results
- **THEN** the "一键生成" button appears in the card header

### Requirement: Each card has independent expand/collapse-all controls
Each card (Preset Q&A and User Q&A) SHALL have its own "全部展开" and "全部折叠" buttons that only affect questions within that card.

#### Scenario: User clicks expand-all on Template QA card
- **WHEN** user clicks "全部展开" on the Preset Q&A card
- **THEN** only preset QA questions expand; user QA questions remain unchanged

### Requirement: Preset QA is public, User QA is owner-scoped
On the paper detail page, the Preset Q&A card SHALL be visible to everyone, including anonymous visitors. The User Q&A card SHALL display only the current authenticated user's user QA entries; anonymous visitors and other users SHALL NOT see a user's user QA entries.

#### Scenario: Anonymous visitor sees only template QA
- **WHEN** an anonymous visitor opens a paper detail page that has both preset and user QA
- **THEN** the Preset Q&A card SHALL be shown with its results, and the User Q&A card SHALL show no entries

#### Scenario: User sees only their own free QA
- **WHEN** an authenticated user opens a paper detail page
- **THEN** the User Q&A card SHALL show only that user's user QA entries for the paper

#### Scenario: Another user's free QA hidden
- **WHEN** user B opens a paper for which user A created user QA entries
- **THEN** user B SHALL NOT see user A's user QA entries

### Requirement: QA generation requires login
Triggering any LLM action on the paper detail page — generating or regenerating preset Q&A, submitting a user question, regenerating, or deleting a result — SHALL require an authenticated user. For anonymous visitors these controls SHALL prompt for login rather than initiate an LLM call.

#### Scenario: Anonymous user attempts to generate template QA
- **WHEN** an anonymous visitor activates the "一键生成" or a single preset generate control
- **THEN** the system SHALL prompt for login and SHALL NOT trigger any LLM call

#### Scenario: Anonymous user attempts a free question
- **WHEN** an anonymous visitor attempts to submit a user question
- **THEN** the system SHALL prompt for login and SHALL NOT create a QA entry

#### Scenario: Authenticated user generates normally
- **WHEN** an authenticated user triggers preset or user QA
- **THEN** the system SHALL proceed, attributing the user QA entry to that user

### Requirement: PaperDetail shows every QA Result attempt state
PaperDetail SHALL render queued, awaiting-output, streaming, done, failed, and cancelled Result attempts as independently selectable tabs within their existing QA entry. A newly created run SHALL appear immediately and become the selected latest tab; older completed answers SHALL remain accessible.

#### Scenario: New regeneration appears beside history
- **WHEN** a user regenerates an entry that already has completed answers
- **THEN** a new active tab SHALL appear and be selected without removing or relabeling the prior tabs

#### Scenario: Failed Result remains inspectable
- **WHEN** a run fails after partial output
- **THEN** its tab SHALL retain the partial answer, failed status, model, error, and retry action while completed sibling tabs remain usable

### Requirement: PaperDetail progressively renders durable Result output
For an active Result, PaperDetail SHALL subscribe to live updates and label queued, awaiting-output, and streaming states distinctly. `awaiting_output` SHALL display a live `Thinking · mm:ss` timer derived from server lifecycle timing; the timer SHALL stop at the first output and MAY remain visible as a frozen “thought for” duration. Streaming output SHALL append genuine persisted batches and progressively render Markdown. A non-streaming provider SHALL remain Thinking until its complete response and SHALL NOT simulate token output. Disconnect/reconnect SHALL reconcile from the server snapshot, with existing polling retained as a fallback.

#### Scenario: First text arrives
- **WHEN** an awaiting-output Result receives its first live delta
- **THEN** the tab SHALL change to streaming, freeze the Thinking duration, and display the partial answer without waiting for terminal completion

#### Scenario: Thinking timer advances without rerendering answer content
- **WHEN** a Result remains awaiting its first output for several seconds
- **THEN** a fixed-width timer SHALL advance at a human-readable cadence while the Result tab, action row, and Markdown container SHALL not remount or rerender

#### Scenario: SSE reconnects
- **WHEN** a Result subscription reconnects after a network interruption
- **THEN** the UI SHALL replace its preview with the persisted start snapshot before applying later deltas

### Requirement: Streaming Markdown remains visually stable and final output is canonical
PaperDetail SHALL render an active answer in a stable Result container. Frontend updates SHALL be coalesced to browser animation frames; previously committed complete Markdown blocks SHALL retain their DOM while only an uncommitted tail is reparsed. The UI SHALL not auto-scroll or animate container height/opacity as chunks arrive. Hash-based highlighting and note-anchor creation SHALL be disabled until the Result is done. After all ordered deltas have been applied, `done` SHALL replace the preview with the authoritative answer and run exactly one complete canonical Markdown/KaTeX/highlight render.

#### Scenario: Several chunks arrive in one frame
- **WHEN** multiple server delta batches are available before the next browser paint
- **THEN** the UI SHALL append them in order and perform at most one preview render in that animation frame

#### Scenario: Provisional Markdown tail changes structure
- **WHEN** an incomplete code fence, formula, list, or table grows across chunks
- **THEN** only the provisional tail SHALL be reparsed and previously committed block DOM SHALL remain mounted

#### Scenario: Generation completes
- **WHEN** the Result receives its authoritative done event
- **THEN** pending preview updates SHALL finish first and the final answer SHALL be fully rendered exactly once before highlights and note anchors become interactive

#### Scenario: Streaming does not move the viewport
- **WHEN** output is appended while the viewer is reading an earlier part of the answer
- **THEN** PaperDetail SHALL NOT automatically scroll the page or replace the surrounding card/tab DOM

### Requirement: PaperDetail offers exact stop and retry actions
An authorized viewer SHALL see a stop action only for an active Result they may cancel and a retry action for a failed/cancelled Result they may manage. Stopping SHALL target that Result only; retrying SHALL create a new Result with the existing preset/free prompt rules rather than mutate the failed one.

#### Scenario: Stop one active tab
- **WHEN** the user stops one active Result in an entry with another active Result
- **THEN** only that tab SHALL become cancelled and the other tab SHALL continue updating

#### Scenario: Retry failed free question
- **WHEN** the owner retries a failed free Result
- **THEN** a new Result SHALL use the immutable persisted free-question text

#### Scenario: Retry failed preset question
- **WHEN** an authorized user retries a failed preset Result
- **THEN** a new Result SHALL use the latest preset text from `config.yml`
