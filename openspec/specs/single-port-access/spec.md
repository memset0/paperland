# single-port-access Specification

## Purpose
TBD - created by archiving change single-port-proxy. Update Purpose after archive.
## Requirements
### Requirement: Single port access
All traffic (frontend pages and API requests) SHALL be accessible through port 5173 only.

#### Scenario: Frontend served on 5173
- **WHEN** a user accesses http://host:5173/
- **THEN** the Vue frontend SHALL be served

#### Scenario: API proxied through 5173
- **WHEN** a user sends a request to http://host:5173/api/papers
- **THEN** the request SHALL be proxied to the backend on localhost:3000 and the response returned

#### Scenario: External API proxied through 5173
- **WHEN** a client sends a request to http://host:5173/external-api/v1/papers
- **THEN** the request SHALL be proxied to the backend on localhost:3000

### Requirement: Backend not externally accessible
The backend SHALL listen on 127.0.0.1 only, not on 0.0.0.0.

#### Scenario: Backend rejects external connections
- **WHEN** an external client attempts to connect directly to port 3000
- **THEN** the connection SHALL be refused

