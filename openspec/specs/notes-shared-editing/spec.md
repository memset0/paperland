# notes-shared-editing Specification

## Purpose
TBD - created by archiving change redesign-notes-single-doc. Update Purpose after archive.
## Requirements
### Requirement: Single shared in-memory document
The frontend SHALL hold exactly one in-memory reactive copy of a (user, paper) note document. The raw Markdown text SHALL be the canonical form and the heading-section tree SHALL be a derived, memoized parse of it. Every editing surface — the left-panel document view, the mind-map, and every floating section window — SHALL bind to this one copy and SHALL NOT keep an independent editable snapshot of the document. An edit on any surface SHALL update the shared copy immediately (write-through), and all other surfaces SHALL re-render from the shared copy without manual refresh.

#### Scenario: Edit on one surface reflects on all
- **WHEN** a floating window edits a section's leaf content
- **THEN** the shared document SHALL update immediately and the left-panel render and the mind-map SHALL reflect the change without a refresh

#### Scenario: No private snapshots
- **WHEN** any surface reads or edits document content
- **THEN** it SHALL operate on the single shared copy and SHALL NOT hold a private editable duplicate of the document

### Requirement: Modal editing contexts
Editing SHALL be modal so that at most one text editor owns the keyboard at a time. In **render mode** the left panel SHALL be a read-only live preview and editing SHALL occur via the mind-map (opening a floating section window, or drag / add / delete to restructure). In **edit mode or split mode** the user SHALL edit the whole Markdown document directly; entering edit or split mode SHALL first close all floating windows, and the mind-map SHALL become a read-only live reflection (no drag) while in this context.

#### Scenario: Render mode edits only via the mind-map
- **WHEN** the left panel is in render mode
- **THEN** the document SHALL be edited only through the mind-map (floating windows or structural operations) and SHALL NOT be typed into directly in the left panel

#### Scenario: Entering full-document editing closes windows
- **WHEN** the user switches the left panel to edit or split mode
- **THEN** all open floating windows SHALL close and the whole document SHALL become directly editable

#### Scenario: Mind-map is read-only during full-document editing
- **WHEN** the left panel is in edit or split mode
- **THEN** the mind-map SHALL be a read-only reflection and SHALL NOT accept drag / add / delete

### Requirement: Structural change closes floating windows
Any structural change to the document — a mind-map drag / add / delete, or entering edit / split mode — SHALL immediately close all open floating section windows, so a window can never write back against a structure that has since shifted.

#### Scenario: Mind-map structural op closes windows
- **WHEN** a user drags, adds, or deletes a node in the mind-map
- **THEN** all open floating section windows SHALL close

#### Scenario: Switching to full-document editing closes windows
- **WHEN** a user enters edit or split mode
- **THEN** all open floating section windows SHALL close

### Requirement: Strict window binding with conflict refusal
A floating section window SHALL bind to the section it edits by capturing, at open time, both (a) a **structure fingerprint** — a hash of the document's heading tree computed from heading levels, heading text, and sibling order only, excluding body content — and (b) a **content baseline** — a hash of its own section's leaf body as loaded. Before the window's edit is written back, and again whenever the document is reloaded after a save conflict, the system SHALL recompute both against the current document. If either the structure fingerprint or this section's content baseline no longer matches, the system SHALL refuse the write-back, SHALL NOT overwrite the document, and SHALL show a conflict prompt asking the user to resolve manually while preserving the window's text. Concurrent leaf edits to different sections SHALL NOT trigger a conflict.

#### Scenario: Structural divergence refuses write-back
- **WHEN** the heading structure changed underneath an open window (a heading was added, moved, or renamed)
- **THEN** the window's write-back SHALL be refused and a conflict prompt SHALL be shown without overwriting the document

#### Scenario: Same-section content divergence refuses write-back
- **WHEN** the leaf body of the section a window is editing was changed by another surface, tab, or device
- **THEN** the window's write-back SHALL be refused and a conflict prompt SHALL be shown without overwriting the document

#### Scenario: Different sections do not conflict
- **WHEN** two windows edit different sections concurrently
- **THEN** neither write-back SHALL be treated as a conflict

#### Scenario: Conflict preserves the user's text
- **WHEN** a conflict is detected
- **THEN** the window SHALL keep the user's typed text so it can be copied out before resolving

### Requirement: Whole-document persistence with optimistic concurrency
The shared document SHALL be persisted by a single debounced whole-document save carrying the document's `updated_at`. A save whose `updated_at` no longer matches the stored row SHALL be rejected with HTTP 409 and the latest content; the client SHALL surface a "modified elsewhere" notice and allow reload. The system SHALL NOT attempt real-time merge across tabs or devices; cross-tab section conflicts SHALL be surfaced through the window-binding prompt above after reload.

#### Scenario: Debounced whole-document save
- **WHEN** the shared document changes and the debounce elapses
- **THEN** the whole document SHALL be saved once, carrying its `updated_at`

#### Scenario: Stale save rejected
- **WHEN** a save carries an `updated_at` that no longer matches the stored row
- **THEN** the server SHALL respond 409 with the latest content and the client SHALL offer to reload

#### Scenario: No silent cross-tab overwrite
- **WHEN** another tab or device has changed the document since this client loaded it
- **THEN** this client's save SHALL NOT silently overwrite the newer content

