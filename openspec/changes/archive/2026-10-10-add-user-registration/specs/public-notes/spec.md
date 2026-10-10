## MODIFIED Requirements

### Requirement: Note link deep-opens the note in the right panel
For a logged-in viewer, opening `/papers/:paperId?note=:noteId` SHALL navigate to that paper and, after it loads, fetch the addressed note and **auto-open it in the right-panel public notes section** (switching to the Note view, expanding that entry, rendering it, and scrolling to it). If the addressed note belongs to the **current viewer**, the system SHALL instead show a brief "this is your own note" hint and SHALL NOT auto-open a public-notes entry (the owner's note already lives in their own Note view). If the note is unavailable (deleted or no longer readable), the system SHALL show a brief notice and SHALL land on the paper without opening anything.

For an anonymous visitor, the same link SHALL render a standalone read-only page (no app shell and no paper data) showing the note's paper title, author display name, and the note rendered read-only as in the right panel, plus a Log in button. If the note is not published (or does not exist), the page SHALL show the Login / Register screen instead.

#### Scenario: Opening another user's note link auto-opens it
- **WHEN** a logged-in viewer opens `/papers/:paperId?note=:noteId` for a public note authored by someone else
- **THEN** the system SHALL navigate to the paper, switch the right panel to the Note view, expand that note's entry, render it, and scroll to it

#### Scenario: Opening own note link shows a hint and skips auto-open
- **WHEN** a viewer opens a `?note=` link that addresses their own note
- **THEN** the system SHALL show a "this is your own note" hint and SHALL NOT auto-open a public-notes entry

#### Scenario: Stale note link degrades gracefully
- **WHEN** a logged-in viewer opens a `?note=` link that addresses a note that is deleted or no longer readable by the viewer
- **THEN** the system SHALL show a brief "note unavailable" notice and land on the paper without opening a note

#### Scenario: Anonymous visitor opens a published note link
- **WHEN** an anonymous visitor opens `/papers/:paperId?note=:noteId` for a published note
- **THEN** the system SHALL show only that note (paper title, author, read-only body) with a Log in button, and SHALL NOT request any login-only API

#### Scenario: Anonymous visitor opens an unpublished note link
- **WHEN** an anonymous visitor opens a `?note=` link for a note that is not published
- **THEN** the system SHALL show the Login / Register screen
