# data-sharing-preferences Specification

## Purpose
Defines which user data is always shared, always private, or shared at the owner's choice, the per-user per-type sharing switches, and the uniform `mine`/`all` read scope and role rules that every list of shareable data follows.

## Requirements

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
The Settings page's Account area SHALL include a "Sharing" section with one switch each for Highlights, Notes, Q&A, Reference links, and Research, reflecting the caller's effective values and saving changes immediately via `PUT /api/auth/me/sharing`. The section SHALL explain that switched-on data appears in other users' "All" lists, that admins can see all data regardless, and that published notes are always listed.

#### Scenario: Toggle a switch in the dialog
- **WHEN** a user turns off the Q&A switch on the Settings page
- **THEN** the system SHALL persist the change and the switch SHALL remain off after reloading the page

### Requirement: Uniform mine/all read scope
Every list or overlay of optionally-shared data SHALL accept a scope of `mine` or `all` (default `mine`) and SHALL apply these rules for an authenticated caller:
- `mine` SHALL return only rows owned by the caller.
- `all` for a non-admin SHALL return the caller's own rows plus rows of other users whose sharing switch for that data type is on (and, for notes, other users' published notes regardless of switch).
- `all` for an admin SHALL return every user's rows regardless of sharing switches.
Each returned row SHALL carry its owner's `user_id`, `username`, and `display_name` (the owner's nickname when set, otherwise their username), and a `shared` boolean giving whether the row is visible to non-admin others (the owner's switch, or a note's published state). Anonymous callers SHALL receive only always-shared data and published notes; optionally-shared data otherwise SHALL be empty with HTTP 200 where the endpoint is public.

#### Scenario: Non-admin all scope
- **WHEN** user B (non-admin) requests `all` and user A shares Q&A while user C does not
- **THEN** the response SHALL include B's own, A's, and not C's free Q&A

#### Scenario: Admin all scope ignores switches
- **WHEN** an admin requests `all` and user C does not share Q&A
- **THEN** the response SHALL include user C's free Q&A with `shared: false`

#### Scenario: Owner attribution
- **WHEN** any row not owned by the caller is returned
- **THEN** it SHALL carry the owner's `username` and `display_name`

### Requirement: Scope selector and attribution in the UI
Each page or panel that lists optionally-shared data offers authenticated users a Mine / All selector, except where a section by definition shows only others' data. These are:
- the `/notes` page
- the `/qa` feed
- the paper detail User Q&A card
- the paper detail reference links section
- highlight rendering on paper and Q&A content
- the paper detail "others' notes" section

The paper list does as well (see `personal-paper-library`).

The highlight Mine / All selector is a single viewer-wide setting for the whole paper page: whether others' highlights are shown on Q&A answers is one choice, regardless of whether the answer is a preset or a user Q&A. On the paper detail page it SHALL be offered in both the Preset Q&A and the User Q&A card headers (a user may highlight another user's shared User Q&A, so the switch is needed there even when no preset Q&A exists), and the two SHALL always show and change the same value. It SHALL be visually distinguished from the User Q&A list selector by a highlighter icon.

Every such selector SHALL be the same shared UI component, labelled exactly "Mine" and "All" (English, no other wording such as "My Q&A"). It SHALL come in a page-toolbar size and a smaller in-section size; the paper list uses the smaller size. It SHALL be a segmented control (a muted track with an inset selected pill). Switching SHALL animate the selected pill sliding between the two options, except when the user prefers reduced motion.

Every item not owned by the viewer SHALL display its owner's display name (nickname when set, otherwise username). Wherever another requirement says an item shows its owner's or asker's username, the UI SHALL show this display name. For an admin, items with `shared: false` that belong to someone else SHALL additionally display a "Private" marker.

#### Scenario: Other user's item labeled
- **WHEN** a user views the All scope and sees an item owned by someone else
- **THEN** the item SHALL show the owner's display name

#### Scenario: Admin sees private marker
- **WHEN** an admin views the All scope and an item belongs to a user who does not share that type
- **THEN** the item SHALL show a "Private" marker in addition to the display name

#### Scenario: Nickname shown instead of username
- **WHEN** user A has nickname `Alice W` and user B views A's shared item in the All scope
- **THEN** the item SHALL show `Alice W`, and SHALL show A's username when A clears the nickname

#### Scenario: Highlight selector synchronized across Q&A cards
- **WHEN** a user switches the highlight selector in the User Q&A card header to All
- **THEN** others' shared highlights SHALL appear on every answer on the page (preset and user Q&A), and the highlight selector in the Preset Q&A card header SHALL also show All

#### Scenario: Uniform selector
- **WHEN** a user switches from Mine to All on any of these lists
- **THEN** the same "Mine" / "All" control SHALL be used, and its highlight SHALL slide to "All"

### Requirement: Viewing others' data is read-only
Visibility of another user's data SHALL NOT grant mutation rights. Updating or deleting a highlight, note, free Q&A entry/result, or reference link SHALL remain limited to its owner or an admin (where admin management already exists); the UI SHALL NOT show edit or delete affordances on others' items for non-admins, and the backend SHALL reject such mutations without changing data.

#### Scenario: Non-owner cannot delete a shared reference link
- **WHEN** user B sees user A's shared reference link and calls its delete endpoint
- **THEN** the system SHALL reject the request and the link SHALL remain
