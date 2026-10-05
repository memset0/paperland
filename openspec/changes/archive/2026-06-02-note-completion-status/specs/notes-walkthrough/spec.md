## ADDED Requirements

### Requirement: Completion toggle in the note function bar
The left-panel note view's function bar SHALL include a completion toggle — a button group with two states (e.g. "In progress" / "Done") — bound to the note's `completed` flag. Activating "Done" SHALL mark the note complete (via `POST /api/papers/:id/note/completed`); activating "In progress" SHALL mark it incomplete. The reflected state SHALL update on success. The toggle SHALL be available to authenticated users; marking a note with no content complete SHALL be disabled (there is nothing to complete).

#### Scenario: Mark the note done from the function bar
- **WHEN** an authenticated user with a non-empty note activates "Done" in the function bar
- **THEN** the note SHALL be marked complete and the toggle SHALL reflect the Done state

#### Scenario: Toggle back to in progress
- **WHEN** the user activates "In progress" on a completed note
- **THEN** the note SHALL be marked incomplete and the toggle SHALL reflect the In-progress state

#### Scenario: Cannot complete an empty note
- **WHEN** the note has no content
- **THEN** the "Done" control SHALL be disabled
