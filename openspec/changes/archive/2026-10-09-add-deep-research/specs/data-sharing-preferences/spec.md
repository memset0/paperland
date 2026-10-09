## MODIFIED Requirements

### Requirement: Data visibility classification
The system SHALL classify data into three visibility classes:
- **Always shared** — papers (every paper any user adds appears in the site-wide paper list, so the same paper is never fetched twice), Preset (template) Q&A, and the translation cache. These SHALL NOT be affected by any user's sharing switch.
- **Always private** — tags (and paper-tag assignments), the image-host management list, API tokens, and Q&A reading preferences. These SHALL be returned only to their owner and SHALL NOT appear in any `all` scope, including for admins, except where an admin-only management capability already exists.
- **Optionally shared** — highlights, notes, free (user) Q&A, reference links, and research sessions. Their visibility to other users SHALL be governed by the owner's sharing switch for that data type. Any future question type stored as a free Q&A entry (e.g. asking from a text selection or screenshot) SHALL inherit the free Q&A switch.

#### Scenario: Paper added by one user appears for everyone
- **WHEN** user A adds a paper and user B opens the paper list
- **THEN** user B SHALL see that paper regardless of either user's sharing switches

#### Scenario: Tags never shared
- **WHEN** user A has tags and user B (including an admin) views the paper list or tag management page
- **THEN** user B SHALL NOT see user A's tags

#### Scenario: Optional data follows the switch
- **WHEN** user A turns off sharing for highlights
- **THEN** user A's highlights SHALL NOT appear in any non-admin user's `all` scope

### Requirement: Per-user per-type sharing switch
Each user SHALL have exactly one sharing switch per optionally-shared data type: `highlights`, `notes`, `qa`, `reference_links`, and `research`. A switch SHALL apply to all of that user's data of that type, both existing and created later; there SHALL be no per-item sharing override (the note publish flag is a separate feature, see the `public-notes` capability). When a user has never set a switch, its effective value SHALL be the site default `sharing.default_shared` from `config.yml`, which SHALL default to `true` when absent — except the `research` switch, whose effective default SHALL be `false` (private) regardless of `sharing.default_shared`.

#### Scenario: Default is shared
- **WHEN** a user has never changed any sharing switch and `sharing.default_shared` is unset
- **THEN** the `highlights`, `notes`, `qa`, and `reference_links` switches SHALL be effectively on, and that user's existing and new data of those types SHALL be visible in other users' `all` scope

#### Scenario: Research is private by default
- **WHEN** a user has never changed the `research` switch
- **THEN** that user's research sessions SHALL NOT appear in any non-admin user's `all` scope

#### Scenario: Turning a switch off hides existing data
- **WHEN** a user turns the `notes` switch off
- **THEN** all of that user's notes (except published ones) SHALL immediately stop appearing in non-admin users' `all` scope, without modifying the notes themselves

#### Scenario: Switches are independent
- **WHEN** a user turns `qa` off but leaves `highlights` on
- **THEN** that user's free Q&A SHALL be hidden from others while their highlights remain visible

### Requirement: Sharing preferences API
The system SHALL provide `GET /api/auth/me/sharing` returning `{ data: { highlights, notes, qa, reference_links, research } }` with the caller's effective boolean values, and `PUT /api/auth/me/sharing` accepting any subset of those five boolean keys, persisting them, and returning the full effective set. Both endpoints SHALL require authentication (anonymous → 401). Unknown keys or non-boolean values SHALL be rejected with 400 and SHALL NOT change any switch.

#### Scenario: Read effective switches
- **WHEN** an authenticated user who never changed a switch calls `GET /api/auth/me/sharing`
- **THEN** the response SHALL return all five keys set to their effective defaults (`research` false, the others the configured default)

#### Scenario: Update one switch
- **WHEN** an authenticated user calls `PUT /api/auth/me/sharing` with `{ "notes": false }`
- **THEN** the `notes` switch SHALL be off, the other switches SHALL be unchanged, and the response SHALL return all five effective values

#### Scenario: Invalid payload rejected
- **WHEN** a user sends `{ "tags": true }` or `{ "notes": "no" }`
- **THEN** the system SHALL respond 400 and no switch SHALL change

#### Scenario: Anonymous rejected
- **WHEN** an anonymous client calls either endpoint
- **THEN** the system SHALL respond 401

### Requirement: Sharing settings UI
The account dialog SHALL include a "Sharing" section with one switch each for Highlights, Notes, Q&A, Reference links, and Research, reflecting the caller's effective values and saving changes immediately via `PUT /api/auth/me/sharing`. The section SHALL explain that switched-on data appears in other users' "All" lists, that admins can see all data regardless, and that published notes are always listed.

#### Scenario: Toggle a switch in the dialog
- **WHEN** a user turns off the Q&A switch in the account dialog
- **THEN** the system SHALL persist the change and the switch SHALL remain off on reopening the dialog
