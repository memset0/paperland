## Context

Users have no in-app way to learn about features. Home (`/`) is being introduced by the concurrent change `add-home-dashboard`, which owns `HomePage.vue`; this change only adds one section to it.

## Goals / Non-Goals

**Goals:** a repo-versioned, trivially extensible feature registry; per-user seen state in the DB; passive red-dot / count indicators (no push); a browsable list on Home.

**Non-Goals:** admin UI for editing features, rich media (video/GIF), localisation, any active push (dialog, toast, popup) — the user explicitly rejected pushing.

## Decisions

- **Registry lives in the backend** (`packages/backend/src/features.ts`, a typed array). The backend must validate keys for `POST /seen` and compute `seen`, so it is the single source; the frontend never hard-codes features. Alternative (YAML / shared package) adds a loader or breaks the "shared = types only" rule.
- **Images are static SVGs** in `packages/frontend/public/features/<key>.svg`, referenced as `/features/<key>.svg`. Public dir → served without auth and cached by the browser; SVGs use a fixed light palette on their own rounded background, so they read the same in light and dark themes.
- **Release date = archive date** of the shipping change. Sourcing for initial entries: custom-qa `2026-03-18-qa-module` (template + free Q&A); highlight-model-output `2026-03-19-markdown-highlight`; copy-latex `2026-03-20-upgrade-markdown-parser` (commit 9bb7a07 "click-to-copy LaTeX"); notes `2026-05-29-add-paper-notes`; qa-conversation-view `2026-10-10-add-qa-conversation-tree-views`; usage-dashboard `2026-10-10` (`add-home-dashboard`, archived today).
- **Table `feature_views`** keyed by (user_id, feature_key) with `INSERT … ON CONFLICT DO NOTHING` so the first `seen_at` wins. Keys are free text (no FK) because features are not DB rows.
- **Seen = clicked**: a feature becomes seen only when the user clicks (or Enter/Space on) its card, not when Home renders, so the red dot means "not opened yet". Every unseen feature counts regardless of age (no push window, no config key).
- **Pinia store `features`** holds the list and `newCount`; `App.vue` force-loads it whenever the signed-in user id changes (not in embed mode), so the sidebar Home badge and the Home section share one state and `markSeen` updates both optimistically.
- **Badges** reuse the red count style of the Settings pending-registrations badge (`badgeCount(item)` in `App.vue`); the card dot is a small `bg-destructive` circle in the card's top-right corner.

## Risks / Trade-offs

- Brand-new users start with every feature marked new (count = all features) — acceptable onboarding.
- Release dates come from humans editing the registry; a wrong date only affects ordering.
- Schema change → MINOR version bump at archive.
