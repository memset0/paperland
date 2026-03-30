## Why

Currently, Zotero tag sync only happens when a user selects a paper in the sidebar panel — one paper at a time. If a user has hundreds of papers with tags in Zotero, there's no way to bulk-sync all tags to Paperland. A one-click "Sync All Tags" button in the plugin preferences would let users push all Zotero tags to Paperland in one operation, but only for papers that already exist on both sides (no auto-creation).

## What Changes

- Add a "Sync All Tags" button to the Zotero plugin preferences UI (`preferences.xhtml`)
- Implement bulk tag sync logic: iterate all Zotero library items with arXiv IDs, look up each in Paperland (without auto-create), and sync tags for papers that exist on both sides
- Show progress and results to the user (how many papers synced, how many skipped)
- Add localization strings for en-US and zh-CN

## Capabilities

### New Capabilities

- `zotero-bulk-tag-sync`: One-click button in plugin preferences to sync all Zotero tags to Paperland for papers that already exist on both sides

### Modified Capabilities

_(none)_

## Impact

- **Code**: `packages/zotero-plugin/` — new sync module, preferences UI update, hooks update, locale files
- **Backend**: No changes needed. Uses existing `GET /external-api/v1/papers` (lookup without create) and `PATCH /external-api/v1/papers/:id/tags` (tag sync) endpoints
- **APIs**: No new endpoints required
