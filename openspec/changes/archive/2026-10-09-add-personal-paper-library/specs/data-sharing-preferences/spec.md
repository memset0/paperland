## MODIFIED Requirements

### Requirement: Data visibility classification
The system SHALL classify data into three visibility classes:
- **Always shared** — papers, Preset (template) Q&A, conferences, and the translation cache. Every paper any user adds SHALL exist once site-wide and appear in the site-wide (`all`) paper list, so the same paper is never fetched twice. Each user's personal paper library (see `personal-paper-library`) is a private per-user view over these shared papers. None of this data SHALL be affected by any user's sharing switch.
- **Always private** — tags (and paper-tag assignments), paper library membership, the image-host management list, API tokens, and Q&A reading preferences. These SHALL be returned only to their owner and SHALL NOT appear in any `all` scope, including for admins, except where an admin-only management capability already exists.
- **Optionally shared** — highlights, notes, free (user) Q&A, and reference links. Their visibility to other users SHALL be governed by the owner's sharing switch for that data type. Any future question type stored as a free Q&A entry (e.g. asking from a text selection or screenshot) SHALL inherit the free Q&A switch.

#### Scenario: Paper added by one user appears for everyone
- **WHEN** user A adds a paper and user B opens the paper list in the `all` scope
- **THEN** user B SHALL see that paper regardless of either user's sharing switches, and it SHALL NOT appear in user B's `mine` scope unless user B adds it

#### Scenario: Tags never shared
- **WHEN** user A has tags and user B (including an admin) views the paper list or tag management page
- **THEN** user B SHALL NOT see user A's tags

#### Scenario: Optional data follows the switch
- **WHEN** user A turns off sharing for highlights
- **THEN** user A's highlights SHALL NOT appear in any non-admin user's `all` scope

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
