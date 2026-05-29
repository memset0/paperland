## 1. Fix Paper List Tag Display

- [x] 1.1 In `packages/frontend/src/views/PaperList.vue`, filter `(paper as any).tags` to only show tags where the tags store reports `visible === true`

## 2. Spec Sync

- [x] 2.1 Update `openspec/specs/tag-visibility/spec.md` to reflect that hidden tags are also hidden on paper cards in the list view
