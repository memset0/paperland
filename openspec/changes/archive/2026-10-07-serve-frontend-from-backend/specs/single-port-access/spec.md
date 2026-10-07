## MODIFIED Requirements

### Requirement: Single port access
Frontend pages and API requests SHALL share one entry point in each deployment mode: port 5173 through Vite in development, or the loopback backend through an HTTPS reverse proxy in production.

#### Scenario: Frontend served on 5173
- **WHEN** a user accesses http://host:5173/ during development
- **THEN** the Vue frontend SHALL be served by Vite

#### Scenario: API proxied through 5173
- **WHEN** a user sends a request to http://host:5173/api/papers during development
- **THEN** the request SHALL be proxied to the backend on localhost:3000 and the response returned

#### Scenario: External API proxied through 5173
- **WHEN** a client sends a request to http://host:5173/external-api/v1/papers during development
- **THEN** the request SHALL be proxied to the backend on localhost:3000

#### Scenario: Production shares the backend entry point
- **WHEN** the frontend production build is present and the user visits the production HTTPS hostname
- **THEN** the same backend SHALL provide the built frontend, APIs, and image routes without a running Vite server

## ADDED Requirements

### Requirement: Production frontend assets and navigation
When the frontend build contains index.html, the backend SHALL serve the built frontend with correct file content types and SHALL serve index.html for GET or HEAD browser navigation paths. The entry HTML SHALL require revalidation and built assets SHALL support long-lived immutable caching.

#### Scenario: Reload a detail route
- **WHEN** a browser reloads /papers/1 or /images on the production hostname
- **THEN** the backend SHALL return the SPA entry HTML and allow client-side routing

#### Scenario: Load a built asset
- **WHEN** a browser requests an existing built JavaScript or CSS asset
- **THEN** the backend SHALL return that file with its correct content type and immutable cache headers

#### Scenario: Entry HTML stays fresh
- **WHEN** a browser requests / or /index.html
- **THEN** the response SHALL use Cache-Control: no-cache

### Requirement: SPA fallback preserves server routes
SPA fallback SHALL NOT turn unknown API, external API, image, or missing asset requests into HTML. Existing route authorization and streaming behavior SHALL remain unchanged. File paths SHALL remain inside the frontend build directory.

#### Scenario: Unknown API or image route
- **WHEN** a client requests an unknown /api, /external-api, or /image path
- **THEN** the response SHALL remain a non-HTML error

#### Scenario: Missing build asset
- **WHEN** a browser requests a nonexistent /assets file or file-like path
- **THEN** the backend SHALL return 404 instead of index.html

#### Scenario: Non-navigation method
- **WHEN** a client posts to an unknown frontend navigation path
- **THEN** the response SHALL remain 404 rather than serving the SPA

#### Scenario: Build absent
- **WHEN** index.html is absent from the frontend build directory
- **THEN** API-only backend startup and Vite development SHALL remain available
