## MODIFIED Requirements

### Requirement: Sharing settings UI
The Settings page's Account area SHALL include a "Sharing" section with one switch each for Highlights, Notes, Q&A, Reference links, and Research, reflecting the caller's effective values and saving changes immediately via `PUT /api/auth/me/sharing`. The section SHALL explain that switched-on data appears in other users' "All" lists, that admins can see all data regardless, and that published notes are always listed.

#### Scenario: Toggle a switch in the dialog
- **WHEN** a user turns off the Q&A switch on the Settings page
- **THEN** the system SHALL persist the change and the switch SHALL remain off after reloading the page
