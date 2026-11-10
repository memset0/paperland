## MODIFIED Requirements

### Requirement: API tokens table
The database SHALL have an `api_tokens` table with columns: `id` (integer, primary key, autoincrement), `token` (text, unique, not null), `user_id` (integer, nullable, references `users.id`), `created_at` (text, not null), `revoked_at` (text, nullable), `kind` (text, not null, default `personal`; `personal` | `agent` | `topic`), `rotated_at` (text, nullable), and nullable `topic_id` referencing Topics. Topic tokens SHALL store a hashed verifier and bind one user/Topic. A partial unique index on `user_id` where `kind = 'agent'` SHALL allow at most one agent token per user. Existing token values and behavior SHALL remain valid. The additive migration introducing agent tokens SHALL backfill one agent token (`sk-` followed by 64 hex characters) for every active user.

#### Scenario: Create and revoke token
- **WHEN** a token is created and later revoked by setting revoked_at
- **THEN** the token SHALL have a non-null revoked_at timestamp and SHALL be considered invalid

#### Scenario: Second agent token rejected
- **WHEN** an insert attempts a second `agent` token for a user who already has one
- **THEN** the database SHALL reject it with a unique constraint violation

#### Scenario: Topic credential persistence
- **WHEN** a Topic credential is issued
- **THEN** its row SHALL bind the actual user and Topic without retaining the reusable secret in plaintext

## ADDED Requirements

### Requirement: Topic persistence and publication state
Additive migrations SHALL persist Topics, explicit members, immutable commit metadata, a complete current snapshot, authenticated push audit/recovery state and source-aware current directory/paper associations. A published commit pointer SHALL identify the complete readable snapshot. Existing Research, paper and private-user records SHALL remain intact.

#### Scenario: Migrate an existing installation
- **WHEN** the Topic migrations run
- **THEN** existing users, paper content and Research session/step identities SHALL remain unchanged
- **AND** an installation with no Topics SHALL start with an empty Topic list

### Requirement: Aggregate call count fields
The database SHALL store atomic per-tool counters on user and Topic-member records, defaulting to an empty map read as zero. Counters SHALL not reference token identity and SHALL not require a per-request traffic table. Removing an individual grant SHALL preserve its aggregate and fall back to general Topic access.

#### Scenario: Concurrent increments
- **WHEN** several authenticated calls increment the same tool for one user/Topic
- **THEN** user totals and Topic subtotals SHALL retain every increment transactionally

### Requirement: Legacy migration provenance
Topics SHALL store unique nullable legacy-session identity, migration state and a transient conversion plan. Versions SHALL store unique nullable legacy-step identity. Ordinary Topics/commits SHALL not require legacy provenance. Completion SHALL clear transient plans while retaining mappings, so reruns cannot duplicate or overwrite migrated results.

#### Scenario: Resume an import
- **WHEN** an import is interrupted after some source steps are committed
- **THEN** persisted session/step identities SHALL identify the existing Topic and completed versions

### Requirement: Per-Topic default access persistence
An additive migration SHALL add topics.default_access with a default of none. Values SHALL be none, viewer or editor. Membership rows used only for counters SHALL use a default role that follows current policy; inactive rows SHALL preserve counters without granting individual access. Existing Topics, histories, source Research records and explicit grants SHALL remain unchanged.

#### Scenario: Upgrade existing Topics
- **WHEN** the default-access migration runs
- **THEN** every existing Topic SHALL retain its previous readers and writers without granting access to anyone else

### Requirement: Stable reference number registry
An additive registry SHALL retain Topic/stable-entry identities, unique Topic reference numbers, immutable source identity and first commit/time. A Topic indexing marker and publication journals SHALL support idempotent history backfill/recovery without rewriting Git. Removing a catalog entry SHALL not delete its number reservation.

#### Scenario: Interrupted backfill or publication
- **WHEN** registry preparation is interrupted and retried
- **THEN** original reference numbers and first-appearance metadata SHALL be retained without duplicates
