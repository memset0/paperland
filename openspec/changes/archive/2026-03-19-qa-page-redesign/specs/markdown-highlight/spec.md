## MODIFIED Requirements

### Requirement: Page-level highlight data loading
The system SHALL load all highlights for the current page with a single API request when the page mounts, and distribute the data to individual MarkdownContent instances by content_hash. When QA content is displayed on a page other than the paper detail page (e.g., /qa feed), highlights SHALL be loaded and saved using the original paper's pathname (`/papers/:id`) rather than the current route path.

#### Scenario: Page loads with multiple MarkdownContent instances
- **WHEN** a page containing 5 MarkdownContent components loads
- **THEN** exactly one `GET /api/highlights?pathname=...` request SHALL be made, and each component SHALL receive only the highlights matching its own content_hash

#### Scenario: QA feed page highlight binding
- **WHEN** a QA entry for paper 42 is expanded on the /qa feed page
- **THEN** highlights SHALL be loaded from and saved to pathname `/papers/42`, NOT `/qa`

#### Scenario: Highlight created on QA feed page
- **WHEN** a user creates a highlight on QA answer text displayed on the /qa feed page for paper 42
- **THEN** the highlight SHALL be stored with pathname `/papers/42`
- **WHEN** the user navigates to `/papers/42` detail page
- **THEN** the same highlight SHALL be visible on the paper detail page
