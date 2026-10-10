# arxiv-quick-open Specification

## Purpose
Lets a logged-in user jump from any external page carrying an arxiv id straight to that paper in Paperland via a single GET link, creating the paper on demand while guarding the side effect with a per-user CSRF token.

## Requirements

### Requirement: Per-user quick-open token
The system SHALL maintain one quick-open (CSRF) token per user. `GET /api/auth/open-token` SHALL return `{ token }` for the logged-in user, generating a random token (at least 128 bits of entropy) on first request. `POST /api/auth/open-token/regenerate` SHALL replace it with a new random token and return it; the old token SHALL stop working immediately. Both endpoints SHALL require login (401 otherwise).

#### Scenario: First fetch generates a token
- **WHEN** a logged-in user without a token calls `GET /api/auth/open-token`
- **THEN** the response contains a non-empty `token`, and subsequent calls return the same value

#### Scenario: Regenerate invalidates the old token
- **WHEN** the user calls `POST /api/auth/open-token/regenerate`
- **THEN** a different token is returned and quick-open requests using the previous token are rejected

#### Scenario: Anonymous request
- **WHEN** an anonymous client calls either endpoint
- **THEN** the server responds 401

### Requirement: Open-or-create arxiv paper endpoint
`POST /api/papers/open-arxiv` with body `{ arxiv_id, token }` SHALL require login, SHALL reject a token that does not match the current user's quick-open token with 403 `INVALID_OPEN_TOKEN` without creating anything, and SHALL reject an unparseable arxiv id with 422 `VALIDATION_ERROR`. On success it SHALL return `{ paper_id, arxiv_id, created }`, reusing the existing paper when one with the normalized arxiv id exists (promoting a metadata-only paper to listed, as the normal ingest does) and otherwise creating a new listed paper that triggers the service dependency graph.

#### Scenario: Paper does not exist
- **WHEN** a logged-in user posts a valid token and `arxiv_id: "2401.12345v2"` that is not in the library
- **THEN** a paper with `arxiv_id = "2401.12345"` is created and the response has `created: true` and its `paper_id`

#### Scenario: Paper already exists
- **WHEN** the arxiv id already exists in the library
- **THEN** no new paper is created and the response returns the existing `paper_id` with `created: false`

#### Scenario: Wrong token
- **WHEN** the token is missing or does not match the user's token
- **THEN** the server responds 403 and no paper is created

#### Scenario: Not logged in
- **WHEN** the request has no valid session
- **THEN** the server responds 401 and no paper is created

### Requirement: Arxiv id normalization
The system SHALL accept arxiv ids in new-style (`YYMM.NNNN` / `YYMM.NNNNN`) and old-style (`archive[.subject]/YYMMNNN`) forms, optionally prefixed with `arXiv:` (case-insensitive) and optionally suffixed with a version `vN`, and SHALL normalize them by stripping the prefix and version before lookup or storage. Any other input SHALL be rejected as invalid.

#### Scenario: Version and prefix stripped
- **WHEN** the input is `arXiv:1706.03762v7`
- **THEN** the normalized id is `1706.03762`

#### Scenario: Old-style id
- **WHEN** the input is `hep-th/9901001v1`
- **THEN** the normalized id is `hep-th/9901001`

#### Scenario: Garbage input
- **WHEN** the input is `not-an-id`
- **THEN** it is rejected as invalid

### Requirement: Quick-open GET path
The frontend SHALL serve `GET /open/arxiv/<arxiv_id>?token=<token>` (old-style ids containing `/` included). Opening it SHALL call the open-arxiv endpoint and then navigate with history replacement to `/papers/<paper_id>`, so the token-bearing URL does not remain in the tab's history. If the user is not logged in, the page SHALL open the login dialog and continue automatically once login succeeds. On failure (invalid token, invalid id, network error) the page SHALL show the error message and a link back to the paper list instead of redirecting.

#### Scenario: Existing paper
- **WHEN** a logged-in user opens `/open/arxiv/1706.03762?token=<valid>` and the paper exists
- **THEN** the browser ends up on `/papers/<id>` of that paper

#### Scenario: New paper
- **WHEN** the paper does not exist
- **THEN** it is created and the browser ends up on its detail page

#### Scenario: Login required
- **WHEN** an anonymous user opens the path
- **THEN** the login dialog appears, and after a successful login the page proceeds to open the paper

#### Scenario: Served by the production build
- **WHEN** the backend hosts the built frontend and a browser requests `/open/arxiv/2401.12345?token=…` (a path whose last segment looks like a file extension)
- **THEN** the SPA entry HTML is returned (not a 404), for both new-style and old-style ids

#### Scenario: Invalid token
- **WHEN** the token is wrong
- **THEN** the page shows an error explaining the token is invalid and does not create or open any paper

### Requirement: Token management in account settings
The Settings page's Account area SHALL show a "Browser Extension" section displaying the Paperland site URL (current origin) and the user's quick-open token, each with a copy button, plus a button to regenerate the token.

#### Scenario: Copy and regenerate
- **WHEN** the user opens the Settings page
- **THEN** the current token is shown with copy and regenerate controls, and regenerating replaces the displayed token
