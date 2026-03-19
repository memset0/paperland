## Context

The /qa page currently uses a paper-first navigation model: users select a paper from a dropdown, then see all QA entries for that paper. This duplicates the paper detail page's QA section. The new design replaces this with a flat chronological feed of all free QA entries across all papers.

Current state:
- `QAPage.vue` — paper selector + `QAList.vue` per paper
- `QAList.vue` — renders both template and free entries, used by both QAPage and PaperDetail
- `QAResultView.vue` — model tabs, answer display, pin/copy/regenerate/delete actions
- `qa_entries` table lacks `created_at` column
- Highlight store loads highlights by `route.path`, so /qa page binds all highlights to `/qa` pathname

## Goals / Non-Goals

**Goals:**
- Flat chronological feed of free QA entries across all papers on /qa page
- Each entry as a collapsible panel with paper context (title + link)
- Full QA management: regenerate, delete, copy, pin (reusing existing components)
- Proper `created_at` tracking on `qa_entries` for chronological ordering
- Highlights on /qa page bound to original paper pathname

**Non-Goals:**
- Template QA entries on /qa page (remain in paper detail only)
- New question submission from /qa page
- Search/filter functionality on /qa page
- Pagination (can add later if needed; initial load of all free QA should be manageable)

## Decisions

### 1. New API endpoint vs. client-side aggregation

**Decision**: New backend endpoint `GET /api/qa/free` that returns all free QA entries with paper info, ordered by `created_at DESC`.

**Why**: Client-side aggregation would require fetching QA for every paper individually. A single endpoint is simpler and more efficient.

**Alternatives considered**:
- Fetch all papers, then QA per paper — N+1 queries, poor performance
- GraphQL — overkill for this use case

**Response shape**:
```json
{
  "data": [
    {
      "entry_id": 42,
      "paper_id": 7,
      "paper_title": "Attention Is All You Need",
      "status": "done",
      "error": null,
      "prompt": "What is the main contribution?",
      "created_at": "2025-03-15T10:30:00Z",
      "results": [
        {
          "id": 101,
          "model_name": "gpt-4o",
          "prompt": "...",
          "answer": "...",
          "completed_at": "2025-03-15T10:30:15Z",
          "is_pinned": false
        }
      ]
    }
  ]
}
```

### 2. QA page component architecture

**Decision**: Rewrite `QAPage.vue` to render a list of `QAFeedPanel.vue` components. Each panel wraps `QAResultView.vue` for the answer display.

**Why**: `QAResultView.vue` already handles model tabs, markdown rendering, and all actions. We only need a new wrapper panel for the collapsible + paper context header.

**Component hierarchy**:
```
QAPage.vue (new — feed view)
└── QAFeedPanel.vue (new — collapsible panel per entry)
    ├── Header: paper title (link) + question text + status badge + created_at
    └── Body (collapsed by default):
        └── QAResultView.vue (reused — model tabs, answer, actions)
```

### 3. QA store changes

**Decision**: Add a new `feedEntries` state and `fetchFeed()` action to the existing QA store, rather than creating a separate store.

**Why**: Reuses existing actions like `regenerateEntry`, `deleteResult`. The feed is just a different view of the same data.

### 4. Schema migration for `created_at`

**Decision**: Add `created_at` column to `qa_entries` with default `''` (empty string), then backfill existing rows using `MIN(qa_results.completed_at)` for that entry. New entries will set `created_at` at insert time.

**Why**: SQLite doesn't support `ALTER TABLE ... SET DEFAULT` well for existing rows. Backfill via a migration SQL statement is the cleanest approach.

### 5. Highlight pathname resolution

**Decision**: Pass a `highlightPathname` prop to `QAResultView` (or the markdown rendering component). When on /qa page, set it to `/papers/${paper_id}` instead of using `route.path`.

**Why**: Minimal change — the highlight store already accepts a pathname parameter. We just need to tell it which pathname to use instead of defaulting to the current route.

**Implementation**: The highlight composable/store `loadForPathname()` already takes a pathname argument. The QA feed panels will pass the paper's pathname explicitly.

## Risks / Trade-offs

- **Performance with many QA entries**: Loading all free QA entries at once could be slow for heavy users. → Mitigation: Can add pagination later. Initial version loads all.
- **Polling complexity**: The current polling mechanism is paper-scoped. Feed view needs to poll across all entries. → Mitigation: Feed endpoint returns status per entry; poll only if any entries are pending/running.
- **Highlight cross-loading**: Multiple QA panels on the same page may reference different papers, requiring highlights from multiple pathnames loaded simultaneously. → Mitigation: Load highlights per-panel lazily when expanded, scoped to the paper's pathname.

## Open Questions

- None — requirements are clear from user confirmation.
