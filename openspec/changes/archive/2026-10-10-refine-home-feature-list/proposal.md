## Why

The Home "Features" section is meant to tell users what is new. Listing every feature, including ones the user has already opened, buries the new ones; once a feature has been seen it should leave Home, while the full history stays reachable on demand. Deep Research (agent-built paper lists) also shipped and should be announced.

## What Changes

- Register **Deep Research** as a feature: "Deep Research paper lists", released 2026-10-09 (archive date of `add-deep-research`), with an SVG illustration.
- Home → Features shows **only unseen features** (newest first, each with the red dot). Clicking a card marks it seen and the card **disappears** from Home immediately.
- When every feature has been seen, the section shows **"No new features"**.
- An **"All features"** button in the section header opens a **dialog** listing the full feature history (newest first, image/title/date/description); unseen ones there keep their red dot and can be clicked to mark seen. Opening the dialog does not mark anything seen.
- The red counts (section header, sidebar Home) are unchanged.

## Capabilities

### New Capabilities

### Modified Capabilities
- `feature-announcements`: registry gains Deep Research; the Home section lists only unseen features with an empty state and an "All features" history dialog.

## Impact

- Backend: `src/features.ts` (new entry), `src/api/features.test.ts` (registry assertions).
- Frontend: `public/features/deep-research.svg`, `components/home/FeatureList.vue`, new `components/home/FeatureHistoryDialog.vue`, `components/FeatureCard.vue` (unchanged behavior, reused).
- Docs: `docs/frontend-architecture.md`, `docs/tech-stack.md`.
- No schema or API change.
