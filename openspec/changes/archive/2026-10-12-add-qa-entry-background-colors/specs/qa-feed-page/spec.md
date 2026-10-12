## ADDED Requirements

### Requirement: Feed QA background control
The QA feed SHALL use the same palette, preference API, and pale container rendering as PaperDetail. A color changed on either surface SHALL appear on the other after refresh.

#### Scenario: Set color in feed
- **WHEN** a user colors an entry in `/qa`
- **THEN** the same entry SHALL show that color on its paper detail page

#### Scenario: Feed pagination
- **WHEN** a page of feed entries loads
- **THEN** each entry SHALL include the current viewer's preference without per-card preference requests

