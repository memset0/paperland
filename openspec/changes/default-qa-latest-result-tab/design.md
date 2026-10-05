## Context

`QAResultView.vue` currently initializes `activeTab` to `''` while passing it through `v-model`, so the Tabs component is controlled and its `default-value` cannot reliably initialize selection. `sortedResults()` sorts ascending by `completed_at`, placing the oldest answer first. Polling also replaces result arrays periodically.

## Goals / Non-Goals

**Goals:**

- Select the latest answer deterministically on first render and after a genuinely new result arrives.
- Preserve a user's valid manual selection across equivalent polling refreshes.
- Keep anchor navigation authoritative.

**Non-Goals:**

- No backend ordering/API/schema change.
- No change to pin persistence, result deletion API, or single-result rendering.

## Decisions

### 1. Extract pure selection helpers

Create a small helper that compares results by parsed completion time then id, returns newest-first ordering, and decides the next active id from previous/current id sets. Pure tests cover invalid/tied times, added/removed ids, and equivalent refreshes.

### 2. Watch a stable result-id signature

Watch a stable signature containing result ids and completion timestamps rather than the array reference. On first run select latest. On change:

- requested anchor exists → let anchor selection win;
- a new id exists → select latest;
- active id disappeared → select latest remaining;
- otherwise preserve active id.

This avoids resetting a manually selected old tab every three-second poll.

### 3. Separate display ordering from default selection

Latest selection ignores pin state. Display sorting applies existing pinned-model precedence first, then newest-first within pinned/unpinned groups. Thus pin remains a visual preference while “default latest” remains literal.

## Risks / Trade-offs

- [Invalid timestamps] → Use id as deterministic fallback.
- [Anchor and new-result update race] → Check valid requestedResultId before automatic selection and retain the existing immediate anchor watcher.
- [Same model repeated] → Use result id, never model name, for active tab identity.

## Migration Plan

No migration. Add helper/tests, update `QAResultView`, build frontend, verify PaperDetail/feed with multiple results, regeneration arrival, manual historical selection during polling, deletion fallback, and anchor navigation. Rollback is a single frontend revert.
