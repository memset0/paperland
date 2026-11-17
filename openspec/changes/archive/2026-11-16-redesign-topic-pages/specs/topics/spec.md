# Spec Delta

## ADDED Requirements

### Requirement: Topics list layout
The web Topics list SHALL show Topics in shadcn cards (title, up to two lines of description, owner, last update, and the reader's role only when it is not Owner), with Mine/All and search above. Active and archived Topics SHALL be on separate "Active" and "Archived (N)" tabs. While loading, skeleton cards SHALL be shown. Each tab SHALL have its own empty state.

#### Scenario: Archived Topics on their own tab
- **WHEN** a reader opens the Topics list and one listed Topic is archived
- **THEN** it SHALL appear only on the "Archived (1)" tab and not among the active cards

#### Scenario: Search across tabs
- **WHEN** a reader searches and matches exist only among archived Topics
- **THEN** the Archived tab count SHALL reflect the matches and the Active tab SHALL say no active topics match

### Requirement: Topic page header
The Topic page SHALL show a breadcrumb back to Topics, the title with History and Share buttons, and a "More actions" menu for the remaining actions (All references, Browse linked papers, Refresh, Rename, Original research, Archive/Unarchive), each offered only when permitted. Owner, role, last update, reference count and short commit SHALL share one meta line. Archived and historical-version states SHALL be alerts. Rename SHALL use a dialog.

#### Scenario: Owner archives from the menu
- **WHEN** the owner opens "More actions" on an active Topic and chooses Archive, then confirms
- **THEN** the Topic SHALL be archived and the archived alert SHALL appear

#### Scenario: Viewer sees no edit actions
- **WHEN** a viewer opens "More actions"
- **THEN** Rename and Archive SHALL NOT be offered
