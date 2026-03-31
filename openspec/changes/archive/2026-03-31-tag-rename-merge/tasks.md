## 1. Fix renameTag store function

- [x] 1.1 Modify `renameTag` in `packages/frontend/src/stores/tags.ts` to use raw `fetch` instead of `api.patch`, so that HTTP 409 responses return the parsed JSON body (with `error` and `target_tag` fields) instead of throwing

## 2. Clean up confirmRename error handling

- [x] 2.1 Update `confirmRename` in `packages/frontend/src/views/TagManagement.vue` to remove the redundant 409 catch block (line 68-70), since 409 conflicts will now be handled via the returned response body in the success path (line 58-63)

## 3. Verify end-to-end flow

- [ ] 3.1 Manually verify: rename tag A to existing tag B → merge dialog appears → confirm → tags merged successfully
- [ ] 3.2 Manually verify: rename tag A to existing tag B → merge dialog appears → cancel → tag name reverts
