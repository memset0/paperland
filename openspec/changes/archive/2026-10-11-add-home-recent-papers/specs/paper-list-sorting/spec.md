## ADDED Requirements

### Requirement: Sort by library added time
`GET /api/papers` SHALL accept `sort_by=added_at`. For a signed-in caller in the Mine scope it SHALL order results by when the caller added each paper to their library (`sort_order` applies, default descending, ties broken by paper id). For anonymous callers or `scope=all`, `added_at` SHALL fall back to ordering by `created_at`. Every list item SHALL include `added_at`: the ISO time the caller added the paper to their library, or `null` when the paper is not in the caller's library or the caller is anonymous.

#### Scenario: Recently added first
- **WHEN** a signed-in user who added paper 7 today and paper 3 last week calls `GET /api/papers?sort_by=added_at`
- **THEN** paper 7 SHALL come before paper 3, and both items SHALL carry their `added_at` times

#### Scenario: Site-wide scope falls back
- **WHEN** a signed-in user calls `GET /api/papers?scope=all&sort_by=added_at`
- **THEN** results SHALL be ordered by `created_at` descending, and papers outside the user's library SHALL have `added_at: null`
