## ADDED Requirements

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
