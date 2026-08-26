## ADDED Requirements

### Requirement: QA Result streams follow entry visibility
An authenticated viewer SHALL be allowed to subscribe only to a Result whose parent QA entry is visible to that viewer through the normal QA read rules. Anonymous viewers SHALL NOT open Result SSE streams, and a denied request SHALL NOT disclose whether a private Result exists.

#### Scenario: Viewer subscribes to a visible all-scope Result
- **WHEN** a logged-in viewer can read another user's free QA entry through all scope
- **THEN** the viewer MAY observe that Result stream but SHALL receive no mutation authority

#### Scenario: Anonymous viewer requests a stream
- **WHEN** an anonymous viewer requests a Result SSE stream, including for a preset entry
- **THEN** the request SHALL be rejected before opening the stream

### Requirement: QA Result cancellation is manager-scoped
Cancelling a free-QA Result SHALL require the entry owner or an admin. Cancelling a shared preset Result SHALL require the exact initiating user recorded on that Result or an admin. Read access alone SHALL NOT grant cancellation authority.

#### Scenario: Non-owner watches but cannot cancel
- **WHEN** a normal user can read another user's active Result through all scope
- **THEN** the user MAY observe it but SHALL NOT be able to cancel it

#### Scenario: Preset initiator cancels own run
- **WHEN** the user who initiated an active preset Result requests cancellation
- **THEN** the system SHALL cancel that exact run

#### Scenario: Admin cancels active Result
- **WHEN** an admin cancels any active Result
- **THEN** the system SHALL authorize the exact cancellation
