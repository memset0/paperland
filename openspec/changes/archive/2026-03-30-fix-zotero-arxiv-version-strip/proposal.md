## Why

The Zotero plugin's `extractArxivId()` function currently preserves version suffixes (e.g. `2401.10774v3`) when extracting arXiv IDs. When this versioned ID is sent to the Paperland backend, it can cause deduplication failures and other bugs — the same paper uploaded from different sources or at different versions gets treated as distinct entries. ArXiv version suffixes should be stripped so all versions map to the same canonical paper ID.

## What Changes

- Strip the version suffix (`vN`) from arXiv IDs in the Zotero plugin's `extractArxivId()` function before returning.
- For example, `2401.10774v3` → `2401.10774`, `cond-mat/0312345v2` → `cond-mat/0312345`.
- This applies to all three extraction paths: archiveID field, Extra field, and URL field.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `zotero-paper-lookup`: arXiv ID extraction must strip version suffixes before returning, ensuring only base IDs are sent to the backend.

## Impact

- **Code**: `packages/zotero-plugin/src/modules/arxiv.ts` — the `extractArxivId()` function.
- **Behavior**: All arXiv IDs reported by the plugin will be version-less. Papers previously registered with versioned IDs will now match correctly.
- **APIs**: No backend API changes needed — this is a client-side normalization.
