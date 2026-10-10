## Context

Feature registry, `feature_views` and the red dot / count UI shipped in `add-feature-announcements` (archived 2026-10-10). `FeatureList.vue` renders all features from the `features` Pinia store; `FeatureCard` emits `open` on click for unseen cards and the store's `markSeen` flips `seen` locally.

## Goals / Non-Goals

**Goals:** Home lists only unseen features; empty state; on-demand history dialog; announce Deep Research.

**Non-Goals:** any push; changing the seen semantics (still explicit click); API changes.

## Decisions

- **Filter client-side**: `FeatureList` renders `store.features.filter(f => !f.seen)`. Because `markSeen` flips `seen` locally, a clicked card leaves the list immediately (wrap in `TransitionGroup` for a short fade). The API keeps returning all features with `seen`, which the dialog needs.
- **History dialog** (`components/home/FeatureHistoryDialog.vue`): opened by an "All features" ghost button in the section header (always visible, also when there are new ones). Uses the existing `Dialog` components, scrollable body, the same `FeatureCard` grid (1 column on mobile, 2 on wide). Unseen cards keep the dot and remain clickable; seen cards are static.
- **Empty state**: "No new features" with the "All features" button still in the header.
- **Deep Research entry**: key `deep-research`, title "Deep Research paper lists", `released_at` 2026-10-09 (`2026-10-09-add-deep-research`). Registry order keeps same-day ordering stable; this entry goes before the 2026-10-10 ones in the file, sorting puts it after them.

## Risks / Trade-offs

- A user who clicks by accident loses the card from Home → recoverable via the dialog.
