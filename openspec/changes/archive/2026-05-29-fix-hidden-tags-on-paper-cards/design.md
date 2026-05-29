## Context

The tag visibility toggle was implemented but paper cards in the paper list still render hidden tags. The paper list gets tags from `tags_json` (denormalized `{id, name}[]` on papers table), which doesn't include `visible`. The tags store already has visibility data from `GET /api/tags`.

## Goals / Non-Goals

**Goals:**
- Hide tags with `visible=false` on paper cards in the paper list

**Non-Goals:**
- Changing `tags_json` schema to include `visible` (unnecessary — the store already has this data)
- Hiding tags on the paper detail page (only the list view is affected)

## Decisions

### Filter client-side using tags store

Cross-reference `paper.tags` (from `tags_json`) with the tags store's visibility data. Use a computed or inline filter: only render tags whose `id` maps to a visible tag in the store.

**Alternative**: Add `visible` to `tags_json`. Rejected — would require updating sync logic and all papers' `tags_json` on every visibility toggle, which is heavyweight for a display-only concern.

## Risks / Trade-offs

- **Race condition**: If tags store hasn't loaded yet, all tags would be hidden. Mitigated by `tagsStore.ensureLoaded()` already called in `onMounted`. As fallback, show tags when store isn't loaded yet.
