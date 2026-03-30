## 1. Locale strings

- [x] 1.1 Add bulk sync locale strings to `addon/locale/en-US/preferences.ftl` (`pref-sync-section`, `pref-sync-btn`, `pref-sync-status`)
- [x] 1.2 Add bulk sync locale strings to `addon/locale/zh-CN/preferences.ftl`

## 2. Preferences UI

- [x] 2.1 Add a "Sync All Tags" section with button and status label to `addon/content/preferences.xhtml`

## 3. API helper

- [x] 3.1 Add `lookupPaper(arxivId)` function to `src/modules/api.ts` — calls `GET /external-api/v1/papers?arxiv_id=X` (no auto-create), returns `{ ok, id }` or `{ ok: false }` on 404

## 4. Bulk sync logic

- [x] 4.1 Create `src/modules/bulk-sync.ts` — implement `bulkSyncTags(doc)` that: iterates all Zotero library items, extracts arXiv IDs, looks up each in Paperland (skip if not found), syncs tags, updates progress label, shows summary
- [x] 4.2 Wire up the button click handler in `src/hooks.ts` `onPrefsLoad()` to call `bulkSyncTags(doc)`

## 5. Documentation

- [x] 5.1 Update `docs/zotero-plugin.md` to document the bulk tag sync feature
