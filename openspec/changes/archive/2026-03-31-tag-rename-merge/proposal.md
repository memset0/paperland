## Why

When renaming a tag to a name that already exists, the intended behavior (merge confirmation dialog) never triggers. Instead, a red error "标签名已存在" blocks the rename. This is because the API client throws on HTTP 409 responses before the frontend can read the conflict response body containing the target tag info needed for the merge dialog.

## What Changes

- Fix the API client or the `renameTag` store function to properly return 409 conflict responses instead of throwing, so the merge confirmation dialog in `TagManagement.vue` can be triggered
- The merge dialog and backend merge endpoint already exist and work correctly — only the response handling path needs fixing

## Capabilities

### New Capabilities
_(none — this is a bug fix in existing capability)_

### Modified Capabilities
- `tag-management`: Fix the rename-to-existing-name flow so it triggers the merge confirmation dialog instead of showing a red error message

## Impact

- `packages/frontend/src/api/client.ts` — API client error handling for 409 responses
- `packages/frontend/src/stores/tags.ts` — `renameTag` function response handling
- `packages/frontend/src/views/TagManagement.vue` — `confirmRename` error handling (may need minor adjustments)
