# feature-announcements Specification

## Purpose
Lets users discover Paperland features: a dated features list on Home where features a user has not opened yet carry a red dot and a red count, with per-user seen tracking and no active push.

## Requirements

### Requirement: Feature registry
The system SHALL keep a feature registry in the repository. Each feature SHALL have a unique stable `key`, an English `title`, a short English `description`, an illustrative image, and a `released_at` date (`YYYY-MM-DD`) equal to the archive date of the OpenSpec change that shipped it (or, when no such change exists, the date of the earliest commit that introduced it). Images SHALL be served without login. The registry SHALL initially contain exactly: Custom Q&A (2026-03-18), Highlight model output (2026-03-19), Copy LaTeX (2026-03-20), Notes (2026-05-29), Q&A conversation view (2026-10-10) and Usage dashboard (2026-10-10).

#### Scenario: Registry content
- **WHEN** a signed-in user requests the features list
- **THEN** it SHALL contain the six initial features, each with key, title, description, image URL and release date

#### Scenario: Unreleased feature absent
- **WHEN** the features list is requested
- **THEN** it SHALL NOT contain Deep Research

### Requirement: Per-user seen tracking
The system SHALL record, per user and feature key, whether and when the user has seen the feature. Marking a feature seen SHALL be idempotent and SHALL keep the first `seen_at`. Seen records SHALL be removed when the user is deleted.

#### Scenario: Mark twice
- **WHEN** a user marks feature `notes` seen twice
- **THEN** exactly one seen record SHALL exist with the time of the first mark

### Requirement: Features API
`GET /api/features` SHALL require login and return `{ data: { features } }` where `features` lists every registry entry newest first (ties keep registry order) as `{ key, title, description, image_url, released_at, seen }`, `seen` being the caller's flag. `POST /api/features/seen` SHALL require login, accept `{ keys: string[] }` (at least one key), mark those keys seen for the caller and return `{ success: true }`; any unknown key SHALL make the request fail with 400 and record nothing. Anonymous callers SHALL receive 401 from both.

#### Scenario: Seen flag is per user
- **WHEN** alice marks `notes` seen and bob requests `GET /api/features`
- **THEN** bob's `notes` entry SHALL have `seen = false` while alice's has `seen = true`

#### Scenario: Unknown key
- **WHEN** a user posts `{ keys: ["notes", "nope"] }`
- **THEN** the response SHALL be 400 and `notes` SHALL remain unseen

#### Scenario: Anonymous
- **WHEN** an anonymous caller requests `GET /api/features`
- **THEN** the response SHALL be 401

### Requirement: No active push
The app SHALL NOT push feature announcements: no dialog, popup or toast SHALL open for new features. New features SHALL only be indicated by the red dots and counts described below.

#### Scenario: Signing in with unseen features
- **WHEN** a user with unseen features signs in
- **THEN** no dialog or popup SHALL open, and the sidebar Home entry SHALL show the number of unseen features as a red count

### Requirement: Home features section
The Home page SHALL show a "Features" section listing every registry feature newest first, each as a card with image, title, description and release date. Each unseen feature's card SHALL show a red dot, and the section header SHALL show a red count of unseen features (hidden when zero). Clicking an unseen card (or pressing Enter/Space on it) SHALL mark that feature seen: its red dot SHALL disappear and the counts SHALL decrease by one immediately. Merely opening Home SHALL NOT mark anything seen.

#### Scenario: Clicking a new feature
- **WHEN** a user with three unseen features opens Home and clicks the `copy-latex` card, which shows a red dot
- **THEN** the dot on `copy-latex` SHALL disappear, the header and sidebar counts SHALL show 2, and on the next visit `copy-latex` SHALL show no dot

#### Scenario: Opening Home without clicking
- **WHEN** a user opens Home and leaves without clicking any card
- **THEN** every unseen feature SHALL still show its red dot on the next visit

### Requirement: Sidebar new-feature count
For a signed-in user (outside embed mode), the sidebar Home entry SHALL show a red count equal to the number of unseen features, in both the desktop sidebar and the mobile drawer, and SHALL hide it when zero. The count SHALL reflect the signed-in account and update immediately when a feature is marked seen.

#### Scenario: All features seen
- **WHEN** a user has seen every feature
- **THEN** the sidebar Home entry and the Features header SHALL show no count
