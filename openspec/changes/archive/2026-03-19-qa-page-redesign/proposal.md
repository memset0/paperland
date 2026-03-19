## Why

The current /qa page shows a paper-first view (select paper → see its QA entries), which duplicates the paper detail page's QA functionality. Users want a unified, chronological feed of all free QA interactions across papers for quick browsing and management. Additionally, highlights created on the /qa page are incorrectly bound to the `/qa` pathname instead of the originating paper's pathname, causing highlight fragmentation.

## What Changes

- **Redesign /qa page layout**: Replace paper-selector + per-paper QA list with a flat, chronological list of all free QA entries across all papers, ordered by creation time (newest first).
- **Add `created_at` to `qa_entries` schema**: New column to track when each QA entry was created, enabling proper chronological ordering. Backfill existing entries using earliest associated `qa_results.completed_at`.
- **New backend endpoint**: `GET /api/qa/free` — returns all free QA entries with paper info, paginated, ordered by `created_at` desc.
- **Collapsible QA panels**: Each QA entry is an independent panel, default collapsed, showing question + paper title. Expand to see full answers with all actions (regenerate, delete, copy, pin).
- **Code reuse**: Reuse `QAResultView.vue` and QA store actions from paper detail page.
- **Fix highlight pathname binding**: When rendering QA content on /qa page, bind highlights to the original paper's pathname (`/papers/:id`) instead of `/qa`.
- **Remove paper selector UI** from /qa page (no longer needed).

## Capabilities

### New Capabilities
- `qa-feed-page`: Chronological feed view of all free QA entries across papers, with collapsible panels, paper context display, and full QA management actions.

### Modified Capabilities
- `database-schema`: Add `created_at` column to `qa_entries` table.
- `markdown-highlight`: Fix highlight pathname binding to use paper's pathname instead of current route when viewing QA content on /qa page.

## Impact

- **Frontend**: `QAPage.vue` — full rewrite; new components for feed panels; highlight store usage updated.
- **Backend**: `db/schema.ts` — schema change + migration; `api/qa.ts` — new endpoint for cross-paper free QA listing.
- **Shared**: May need new types for the cross-paper QA response.
- **Database**: Migration to add `created_at` column with backfill.
