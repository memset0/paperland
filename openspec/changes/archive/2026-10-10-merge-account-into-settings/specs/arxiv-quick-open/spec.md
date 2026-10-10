## MODIFIED Requirements

### Requirement: Token management in account settings
The Settings page's Account area SHALL show a "Browser Extension" section displaying the Paperland site URL (current origin) and the user's quick-open token, each with a copy button, plus a button to regenerate the token.

#### Scenario: Copy and regenerate
- **WHEN** the user opens the Settings page
- **THEN** the current token is shown with copy and regenerate controls, and regenerating replaces the displayed token
