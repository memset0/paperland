## REMOVED Requirements

### Requirement: Preset QA is public, User QA is owner-scoped
**Reason**: User QA is no longer strictly owner-scoped; it follows the owner's Q&A sharing switch.
**Migration**: Replaced by "Preset QA is public, User QA follows sharing"; the default Mine view is unchanged.

## ADDED Requirements

### Requirement: Preset QA is public, User QA follows sharing
On the paper detail page, the Preset Q&A card SHALL be visible to everyone, including anonymous visitors. The User Q&A card SHALL default to the current authenticated user's user QA entries (Mine) and SHALL offer authenticated users a Mine / All selector. `GET /api/papers/:id/qa?scope=all` SHALL follow the uniform all-scope rules: for a non-admin, the caller's own free entries plus those of users whose `qa` sharing switch is on; for an admin, every user's free entries. Each free entry SHALL carry `user_id`, `username`, and `shared`; entries owned by others SHALL show the asker and, for an admin viewing an unshared entry, a "Private" marker. Anonymous visitors SHALL see no user QA entries.

#### Scenario: Anonymous visitor sees only template QA
- **WHEN** an anonymous visitor opens a paper detail page that has both preset and user QA
- **THEN** the Preset Q&A card SHALL be shown with its results, and the User Q&A card SHALL show no entries

#### Scenario: User sees only their own free QA by default
- **WHEN** an authenticated user opens a paper detail page
- **THEN** the User Q&A card SHALL show only that user's user QA entries for the paper

#### Scenario: Shared free QA visible in All
- **WHEN** user B selects All on a paper for which user A, who shares Q&A, created user QA entries
- **THEN** user B SHALL see user A's entries labeled with A's username, without management actions

#### Scenario: Unshared free QA hidden from non-admins
- **WHEN** user A does not share Q&A and non-admin user B selects All
- **THEN** user B SHALL NOT see user A's user QA entries
