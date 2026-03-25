## 1. API Module — syncTags Function

- [x] 1.1 Add `syncTags(paperId: number, tagNames: string[])` function to `packages/zotero-plugin/src/modules/api.ts` — calls `PATCH /external-api/v1/papers/:id/tags` with `{ add: tagNames }`, returns `{ ok: boolean, count?: number, error?: string }`

## 2. Panel — Tag Extraction & Sync Integration

- [x] 2.1 In `packages/zotero-plugin/src/modules/panel.ts` `onAsyncRender`, after `resolvePaperId` succeeds, extract Zotero item tags via `item.getTags()` and call `syncTags()` if tags exist
- [x] 2.2 Display tag sync result in panel status area (e.g., "已同步 3 个标签" appended to the existing status line)

## 3. Documentation

- [x] 3.1 Update `docs/external-api.md` Zotero integration section to document tag sync flow
