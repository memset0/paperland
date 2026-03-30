## Context

The service dashboard (`ServiceDashboard.vue`) displays registered services and their execution history in a table. It is currently read-only — users can view statuses and errors but cannot act on them. The backend already exposes `POST /api/papers/:id/services/:serviceName/trigger` for retrying a single service, but no UI surfaces this.

## Goals / Non-Goals

**Goals:**
- Allow users to retry failed/blocked service executions directly from the dashboard
- Show clear feedback (loading state, success/error toast) when a retry is triggered
- Keep the UI minimal — a single action button per row, no modals or complex flows

**Non-Goals:**
- Bulk retry (select multiple executions and retry all) — not needed yet
- Cancel/stop running executions
- Dedicated Pinia store for services — local component state with polling is sufficient

## Decisions

### 1. Retry button placement: inline in execution table row
Add a "Retry" icon button in a new Actions column of the execution history table. Only visible for `failed` and `blocked` status rows.

**Why not a context menu or dropdown?** Single action doesn't warrant the extra interaction. An icon button (RefreshCw from Lucide) is immediately visible and clickable.

### 2. Feedback via inline status change + brief toast
After clicking retry:
- Button shows a spinner briefly
- On success: the execution list refreshes (already polls every 5s, but force an immediate fetch)
- On error: show error text inline or as a brief notification

**Why not a modal confirmation?** Retrying a service is safe and idempotent — no destructive action. Low friction is preferred.

### 3. Call the single-service trigger endpoint
Use `POST /api/papers/:paperId/services/:serviceName/trigger` rather than the all-services trigger. This is precise — only re-runs the failed service, not all services for that paper.

## Risks / Trade-offs

- **Rate limiting**: User might spam the retry button on a rate-limited service → Mitigated by disabling the button while a retry request is in-flight, and the backend's own rate limiter.
- **Stale UI**: The 5-second polling interval means the new execution might not appear instantly → Mitigated by forcing an immediate `fetchAll()` after triggering.
