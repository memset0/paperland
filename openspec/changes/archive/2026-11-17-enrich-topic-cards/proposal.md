# Proposal

## Why

The redesigned Topics list still looks plain to the developer: each card is a bordered box with a title, a description and "mem · Updated 6 days ago". Cards with and without a description have different heights, and nothing shows how large a Topic is. The developer picked a richer card: an identifying tile, a fixed-height description, and a footer with the Topic's size and activity.

## What Changes

- Each Topic card shows:
  - a monogram tile with a stable per-Topic color (from the Topic id);
  - the title, with the Archived or role badge (non-owners) in the top-right;
  - the description clamped to two lines, with the space reserved when it is empty ("No description");
  - a divided footer with the page count, the reference count, the owner's initial avatar with name, and the relative update time.
- All cards in a row have equal heights. Hover gives a subtle lift and border emphasis. Archived cards are slightly muted. The skeletons match the new layout.
- The Topic list API (`GET /api/topics`, MCP `list_topics`) adds `page_count` and `reference_count` to each summary, computed from the published snapshot. This is additive.

## Capabilities

### New Capabilities

### Modified Capabilities
- `topics`: Topic card content and the summary counts.

## Impact

- Backend: `services/topics.ts` `summary()`, shared `TopicSummary`, list tests.
- Frontend: `components/topics/TopicCard.vue`, the list skeleton in `views/TopicsList.vue`.
- Docs: `frontend-architecture.md` (Topics list), `external-api.md` / `topics.md` (summary fields).
