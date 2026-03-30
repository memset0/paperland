## 1. Add Retry Button to Execution Table

- [x] 1.1 Add an "Actions" column to the execution history table in `ServiceDashboard.vue`
- [x] 1.2 Add a RefreshCw icon button in the Actions column for rows with `failed` or `blocked` status
- [x] 1.3 Implement `retryExecution(execution)` function that calls `POST /api/papers/:paperId/services/:serviceName/trigger`

## 2. Loading State and Feedback

- [x] 2.1 Track per-execution loading state (e.g., `retryingId` ref) to show spinner on the clicked button and disable it
- [x] 2.2 On success: force immediate `fetchAll()` to refresh the execution list
- [x] 2.3 On error: display error message (inline or notification)

## 3. Documentation

- [x] 3.1 Update `docs/frontend-architecture.md` to document the retry action on the service dashboard
