## Why

After implementing the tag visibility toggle, hidden tags still appear on paper cards in the paper list. The `tags_json` denormalized field on papers only stores `{id, name}` and doesn't include visibility. The paper list renders all tags from this field without cross-referencing the tag store's visibility state.

## What Changes

- Filter paper card tags in the paper list against the tags store to exclude hidden tags
- The original spec stated hidden tags should still show on paper cards — this corrects that to match user expectations: hidden tags should be hidden everywhere in the paper list view

## Capabilities

### New Capabilities

### Modified Capabilities
- `tag-visibility`: Hidden tags should NOT appear on paper cards in the paper list (previously spec'd as always showing)

## Impact

- **Frontend**: `PaperList.vue` — filter `(paper as any).tags` by visibility from tags store
- **Spec**: Update `tag-visibility` spec scenario "Hidden tag still shown on paper cards"
