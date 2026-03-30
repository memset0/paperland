## Context

The Zotero plugin currently syncs tags per-paper when the user selects it in the sidebar. The backend provides `GET /external-api/v1/papers?arxiv_id=X` for lookup-without-create (returns 404 if not found) and `PATCH /external-api/v1/papers/:id/tags` for tag sync. Both endpoints are already available and require no changes.

## Goals / Non-Goals

**Goals:**
- Add a "Sync All Tags" button to the preferences page
- Iterate all Zotero library items, extract arXiv IDs, look up in Paperland, sync tags for matching papers
- Show progress feedback and a summary when done

**Non-Goals:**
- Auto-creating papers that don't exist in Paperland (explicit requirement: skip them)
- Syncing tags from Paperland back to Zotero (one-way: Zotero → Paperland)
- Background/scheduled sync — this is a manual trigger only

## Decisions

**1. Use `GET /external-api/v1/papers?arxiv_id=X` for lookup (not `/papers/full` with `auto_create=true`)**

The `/papers` endpoint returns the paper if it exists or 404 if not — no side effects. This matches the requirement to skip papers not in Paperland. Using `/papers/full?auto_create=true` would create papers, which we explicitly don't want.

**2. Iterate Zotero library items via `Zotero.Items.getAll(libraryID)`**

Use the Zotero API to get all items in the user's library. Filter to regular items (not notes/attachments) that have arXiv IDs. This is the standard Zotero API approach.

**3. Add the button to the existing preferences groupbox**

Add a new section in `preferences.xhtml` below the API token section with a "Sync All Tags" button and a status label. The click handler lives in `hooks.ts` alongside the existing "Test Connection" handler.

**4. Sequential API calls with progress updates**

Process papers one at a time to avoid overwhelming the backend. Update a status label with progress (e.g., "Syncing 15/42..."). This is simple and gives clear feedback.

## Risks / Trade-offs

- [Risk] Large libraries could take a while (1 API call per paper for lookup + 1 for tag sync). → Acceptable for a manual operation; user sees progress. Sequential processing avoids rate limiting.
- [Risk] Network failures mid-sync. → Log errors per paper, continue with remaining papers, show summary with error count.
