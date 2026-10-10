## Why

Paperland keeps gaining features (custom Q&A, highlights, notes, conversation view, usage dashboard …), but users only find them by accident. A dated features list on Home lets every user discover features; per-user view tracking marks the ones a user has not opened yet with a red dot and a count, without any push.

## What Changes

- A **feature registry** in the repo: each feature has a stable `key`, English `title`, short `description`, an illustrative SVG image and a `released_at` date (= archive date of the OpenSpec change that shipped it). Adding a feature = one registry entry + one SVG.
- Initial entries (dates from `openspec/changes/archive/` folder prefixes or git): Custom Q&A (2026-03-18), Highlight model output (2026-03-19), Copy LaTeX (2026-03-20), Notes (2026-05-29), Q&A conversation view (2026-10-10), Usage dashboard (2026-10-10). Deep Research is not listed yet.
- **New DB table `feature_views`** (`user_id`, `feature_key`, `seen_at`, unique per user + feature). **Database schema change** — the archive must bump MINOR.
- New APIs (login required): `GET /api/features` (registry newest first, each with the caller's `seen` flag) and `POST /api/features/seen` (mark keys seen; idempotent; unknown keys rejected).
- **No push**: there is no dialog or popup. Unseen features are only indicated passively.
- **Features section on Home** (`/`): all features newest first with image, title, description and release date. Unseen cards carry a **red dot**; clicking a card marks it seen and the dot disappears. The section header shows a **red count** of unseen features.
- The sidebar **Home** entry shows the same red count (reusing the existing pending-registrations badge style).

## Capabilities

### New Capabilities
- `feature-announcements`: feature registry, per-user seen tracking, features API, the Home features section with red-dot/count indicators.

### Modified Capabilities
- `database-schema`: adds the `feature_views` table.

## Impact

- Backend: `src/features.ts` (registry), `src/db/schema.ts` + migration, `src/api/features.ts`, `src/index.ts`, tests.
- Frontend: `public/features/*.svg`, `api/client.ts`, `stores/features.ts`, `components/FeatureCard.vue`, `components/home/FeatureList.vue`, `App.vue` (sidebar Home badge), `views/HomePage.vue` (one line; the page belongs to `add-home-dashboard`).
- Shared: `FeatureItem` / `FeatureListResponse` types.
- Docs (`frontend-architecture.md`, `tech-stack.md`; `external-api.md` unaffected — internal API only).
