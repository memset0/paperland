## ADDED Requirements

### Requirement: Preferences pane for plugin configuration
The plugin SHALL provide a preferences pane accessible from Zotero's Add-ons Manager (or Tools → Paperland Settings). The preferences pane SHALL allow users to configure the Paperland connection.

#### Scenario: Opening preferences
- **WHEN** the user opens the plugin's preferences (via Add-ons Manager → Paperland → Preferences)
- **THEN** a preferences dialog is displayed with fields for host, username, password, and API token

### Requirement: Host URL configuration
The preferences SHALL include a text input for the Paperland host URL (e.g., `https://paperland.dev.mem.ac`). The field SHALL default to empty and MUST be set before the plugin can function.

#### Scenario: Setting the host URL
- **WHEN** the user enters `https://paperland.example.com` in the host field and saves
- **THEN** the plugin uses this URL for all API calls and page embedding

#### Scenario: Host URL not configured
- **WHEN** the host URL is empty and the user selects an arXiv paper
- **THEN** the sidebar panel shows a message directing the user to configure the plugin in preferences

### Requirement: Basic Auth credentials configuration
The preferences SHALL include text inputs for username and password. These credentials are used for authenticating the embedded browser when loading Paperland pages.

#### Scenario: Setting Basic Auth credentials
- **WHEN** the user enters username `admin` and password `secret` and saves
- **THEN** the embedded browser uses these credentials when loading Paperland pages

#### Scenario: Auth disabled on server
- **WHEN** the Paperland instance has auth disabled (`auth.enabled: false`)
- **THEN** the user MAY leave username and password empty, and the embedded browser loads pages without authentication

### Requirement: API Bearer token configuration
The preferences SHALL include a text input for the API Bearer token. This token is used for external API calls (paper lookup/creation).

#### Scenario: Setting the API token
- **WHEN** the user enters `sk-abc123...` in the API token field and saves
- **THEN** the plugin uses this token in `Authorization: Bearer sk-abc123...` header for all external API requests

### Requirement: Persistent preference storage
All preference values SHALL be persisted across Zotero restarts using Zotero's built-in preference system (`Zotero.Prefs`).

#### Scenario: Preferences survive restart
- **WHEN** the user configures host, credentials, and token, then restarts Zotero
- **THEN** all configured values are preserved and the plugin functions without reconfiguration
