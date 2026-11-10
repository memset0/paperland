## MODIFIED Requirements

### Requirement: Token listing API
The Internal API SHALL provide an admin-only endpoint to list personal and agent API tokens with their id, kind (`personal` | `agent`), masked token value, owning user, `created_at`, `rotated_at`, and `revoked_at`. For agent tokens the token value SHALL be null (not even masked). Topic credentials SHALL be managed through their member-scoped Topic endpoints and SHALL NOT appear in this general list or be revocable through the general admin endpoint.

#### Scenario: List tokens
- **WHEN** an authenticated admin calls `GET /api/settings/tokens`
- **THEN** the server SHALL return personal/agent tokens with personal token values partially masked (e.g., "sk-xxxx...xxxx") and the owning user

#### Scenario: Agent token listed without value
- **WHEN** an admin lists tokens and a user has an agent token
- **THEN** that row SHALL have `kind: "agent"` and `token: null`

#### Scenario: Topic credential remains member-scoped
- **WHEN** a non-member admin lists or attempts to revoke a Topic credential through general token management
- **THEN** it SHALL not be disclosed or changed through that endpoint
