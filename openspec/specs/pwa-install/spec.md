# pwa-install Specification

## Purpose
Lets users install Paperland as a standalone app (desktop or home-screen) from the browser, with an explicit install entry at the top of Settings.

## Requirements

### Requirement: Installable web app
The site SHALL be installable as a progressive web app: it SHALL serve a web app manifest linked from the HTML entry with name "Paperland", a start URL of `/`, standalone display, theme and background colors, and PNG icons of at least 192×192 and 512×512 (including a maskable icon). It SHALL register a service worker scoped to `/` that does not cache or alter any request, so online behavior, authentication, and streaming responses are unchanged. The manifest, icons, and service worker SHALL be reachable without logging in.

#### Scenario: Manifest is linked and served
- **WHEN** a browser loads any page of the site
- **THEN** the HTML SHALL link the manifest, and fetching the manifest and its icons SHALL succeed without a session

#### Scenario: Service worker does not intercept
- **WHEN** the service worker is active and the app requests `/api/*` or a streaming endpoint
- **THEN** the request SHALL reach the network exactly as without the service worker

### Requirement: Install app section in Settings
The topmost section of the Settings page SHALL be "Install app". It SHALL:
- show an "Install" button when the browser offers a native install prompt; clicking it SHALL open that prompt, and after the user accepts, the section SHALL show that the app is installed;
- show that Paperland is already running as an installed app when the page is displayed in standalone mode;
- otherwise show brief manual instructions (e.g. Safari: Share → Add to Home Screen / Add to Dock; Chromium: the install icon in the address bar or the browser menu), without an Install button.

#### Scenario: Native prompt available
- **WHEN** the browser has fired its install-prompt event before or after Settings is opened
- **THEN** the Install app section SHALL show an enabled "Install" button that opens the browser's install dialog

#### Scenario: Running as installed app
- **WHEN** Settings is opened inside the installed standalone app window
- **THEN** the section SHALL state that the app is installed and SHALL NOT show an Install button

#### Scenario: No native prompt
- **WHEN** the browser does not offer an install prompt (e.g. iOS Safari or Firefox)
- **THEN** the section SHALL show manual installation instructions
