## MODIFIED Requirements

### Requirement: Reference links section in the paper detail page
The paper detail page SHALL present a "Reference links" section that lists reference links for the paper, with a Mine / All selector for authenticated users (default Mine). The controls to add links SHALL be presented only to an authenticated user, and edit/delete controls SHALL be presented only on the viewer's own links; an unauthenticated viewer SHALL NOT see add/edit/delete affordances. Links owned by someone else SHALL show the owner's username (and, for an admin viewing an unshared link, a "Private" marker). Each link SHALL render as a hyperlink to its `url` that opens in a new tab with `rel="noopener noreferrer"`, using a display label resolved by the fallback chain `title → description → url`. After a successful add/edit/delete the displayed list SHALL reflect the change without a full page reload.

#### Scenario: Link label uses the fallback chain
- **WHEN** a link has no title but has a description
- **THEN** the link SHALL render with the description as its label; **AND WHEN** a link has neither title nor description, it SHALL render with its url as the label

#### Scenario: Management controls hidden when unauthenticated
- **WHEN** an unauthenticated user views the paper detail page
- **THEN** the "Reference links" section SHALL NOT show add, edit, or delete controls

#### Scenario: Others' links are read-only and attributed
- **WHEN** a user switches the section to All and another user's link appears
- **THEN** the link SHALL show its owner's username and SHALL NOT show edit or delete controls

#### Scenario: Add a link from the UI
- **WHEN** an authenticated user enters a url (and optionally a title) and submits
- **THEN** the new link SHALL be created and appear in the list without a full page reload

#### Scenario: Form fields — required url, optional title, read-only description
- **WHEN** an authenticated user opens the add/edit form
- **THEN** the form SHALL present a required url input and an optional title input, and SHALL show the auto-derived description as read-only text (no manual description input)

#### Scenario: Edit and delete from the UI
- **WHEN** an authenticated user edits one of their own links' url and saves, or deletes one of their own links
- **THEN** the list SHALL update in place to reflect the edit or removal

#### Scenario: Deleting a link asks for confirmation
- **WHEN** an authenticated user clicks delete on a reference link
- **THEN** the UI SHALL ask for confirmation first, and SHALL only remove the link if the user confirms (cancelling leaves it untouched)
