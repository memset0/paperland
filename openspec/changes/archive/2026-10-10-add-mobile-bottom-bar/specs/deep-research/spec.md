## MODIFIED Requirements

### Requirement: Research pages
The sidebar SHALL include a login-required "Research" entry linking to `/research`, a management page wrapped in `AppPage` that lists sessions (title, topic excerpt, round count, latest status, updated time) with a "New research" action and a `mine`/`all` scope selector. `/research/:id` SHALL be a detail page with its own layout showing the step timeline (agent rounds with user text, status, `changes` note, and list-change summary; title edits with what changed) and the selected version (report and paper list), plus an input for the next round with a Codex model selector for the owner. In the wide layout (900px and wider) the left column SHALL show, from top to bottom, the owner's input (with any queued messages) and then the steps newest first; the selected version is in the right column. In the narrow layout the page SHALL use the mobile bottom bar sections Instruct / Report / Papers (see `mobile-bottom-bar`). Every finished agent round SHALL show how long it ran (from start to finish, e.g. `3m 12s`).

#### Scenario: Navigate to research
- **WHEN** a logged-in user clicks "Research" in the sidebar
- **THEN** the `/research` page SHALL show their sessions and a "New research" action

#### Scenario: Newest round first on desktop
- **WHEN** the owner opens a session with three rounds on a wide screen
- **THEN** the left column SHALL show the input at the top, then round 3, round 2, round 1

#### Scenario: Round duration is shown
- **WHEN** a round started at 10:00:00 and finished at 10:03:12
- **THEN** the timeline SHALL show `3m 12s` for that round
