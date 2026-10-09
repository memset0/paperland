## Purpose

Gives logged-in users an in-app place to download the Paperland browser extension, pre-configured for their account, together with installation and usage guidance.

## ADDED Requirements

### Requirement: Extension page in the sidebar
The frontend SHALL provide a top-level page at `/extension` titled "Extension", listed in the sidebar (desktop and mobile navigation) and requiring login like other per-user pages. The page SHALL use the shared `AppPage` layout and show: a download button, installation steps for Chromium browsers (Chrome/Edge) and Firefox, the site URL and the user's quick-open token with copy and regenerate controls, and the supported sites plus the `Alt+Shift+P` shortcut.

#### Scenario: Logged-in user opens the page
- **WHEN** a logged-in user clicks "Extension" in the sidebar
- **THEN** the page shows the download button, install steps, site URL and current token

#### Scenario: Anonymous user
- **WHEN** an anonymous user navigates to `/extension`
- **THEN** the login prompt is shown, as for other login-required pages

#### Scenario: Regenerate token from the page
- **WHEN** the user regenerates the token on the page
- **THEN** the displayed token changes and later downloads embed the new token

### Requirement: Personalized extension download
`GET /api/extension/download?base_url=<url>` SHALL require login (401 otherwise) and SHALL reject a `base_url` that is not an absolute `http(s)` URL with 422. On success it SHALL return a zip archive (`Content-Type: application/zip`, attachment filename `paperland-extension-<version>.zip`) containing the extension's runtime files at the archive root — `manifest.json`, `icons/*`, `src/*` — and excluding tests and package metadata, plus `src/preset.json` holding `{ "base_url": <base_url without trailing slash>, "token": <the user's quick-open token> }` (generating the token if needed).

#### Scenario: Download as logged-in user
- **WHEN** a logged-in user requests `/api/extension/download?base_url=https://paper.example.com/`
- **THEN** the response is a valid zip whose root contains `manifest.json`, the icons and `src/background.js`, and whose `src/preset.json` holds `base_url = "https://paper.example.com"` and the user's current token

#### Scenario: Invalid base URL
- **WHEN** `base_url` is missing or not an http(s) URL
- **THEN** the server responds 422

#### Scenario: Anonymous
- **WHEN** no session is present
- **THEN** the server responds 401
