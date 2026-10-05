## ADDED Requirements

### Requirement: Paper-list note-status column
The paper list SHALL show, for each paper, a note-status indicator for the current user as the **leftmost column** (so it is easy to scan), with three states:
- **none** — the user has no note content for the paper (empty/muted icon);
- **has-notes** — the user has a non-empty note that is not marked complete (a circle);
- **completed** — the user has a non-empty note marked complete (a checked circle).
The statuses SHALL be derived from the user's notes (e.g. the `GET /api/notes` aggregate, which carries `paper_id` and `completed`); papers absent from that set SHALL render the **none** state. For an anonymous user the column SHALL render the **none** state (no statuses are fetched).

#### Scenario: Paper with no note
- **WHEN** the user has no note content for a paper
- **THEN** that paper's note-status cell SHALL show the empty/none state

#### Scenario: Paper with notes shows a circle
- **WHEN** the user has a non-empty note for a paper that is not marked complete
- **THEN** the cell SHALL show the circle (has-notes) state

#### Scenario: Completed paper shows a checked circle
- **WHEN** the user's note for a paper is marked complete
- **THEN** the cell SHALL show the checked-circle (completed) state

### Requirement: Note-status cell links to the paper's note tab
Clicking a paper's note-status indicator SHALL navigate to that paper's detail page with its **Note** tab activated.

#### Scenario: Click navigates to the Note tab
- **WHEN** the user clicks a paper's note-status indicator
- **THEN** the app SHALL open that paper's detail page and activate its "Note" tab (e.g. via a `?view=note` route query that the viewer honors)
