## Why

On the conference detail page (`/conferences/:id`), the external-link chips and the per-row topic tag are visually inconsistent with the rest of the app and partly redundant. The arXiv chip renders as a muted gray pill while the paper detail page renders arXiv in red, so the same source reads differently in two places. Each candidate row also repeats a `#topic` tag even though the rows are already grouped under that exact topic/session — duplicating information the user just scanned in the group header.

## What Changes

- Render the candidate card's external-link badges with source-specific styling that matches the paper detail page:
  - **arXiv** badge → red (`destructive` variant), matching the detail page's arXiv styling, instead of the current gray chip.
  - **Semantic Scholar (S2)** badge → keep the existing blue `S2Badge` (already consistent).
  - **OpenReview** (and other non-arXiv `原文` links) badge → gray (`secondary` variant), a proper badge instead of the ad-hoc gray `chipClass` anchor.
- Each badge still renders only when its link/id exists (arXiv id, corpus id, or `link`).
- Remove the redundant per-row `#topic` (which-session) tag from the candidate card. Editing a candidate's topic remains available via the row's `⋯` overflow menu (`编辑主题`), and the inline topic editor still appears when that action is triggered.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `conference-candidate-screening`: tighten the "Unified external links row" requirement to specify per-source badge styling (red arXiv / blue S2 / gray OpenReview) consistent with the paper detail page, and remove the redundant inline per-row topic tag from the candidate card while preserving topic editing through the overflow menu.

## Impact

- `packages/frontend/src/views/ConferenceDetail.vue` — links/topic row of each candidate card (arXiv chip → red badge, `原文`/OpenReview chip → gray badge, remove the `#topic` badge). Reuses the existing `Badge` component and the existing `S2Badge`.
- No backend, database, or API changes. Frontend-only, purely presentational.
- Docs: update `docs/frontend-architecture.md` to reflect the badge styling on the conference candidate card.
