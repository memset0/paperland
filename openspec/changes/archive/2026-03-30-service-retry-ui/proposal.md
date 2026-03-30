## Why

The service management page is currently read-only — users can see service execution history but cannot take any action on failed or blocked executions. When a service like `arxiv_metadata_service` fails (e.g., due to rate limiting), users must manually call the backend API via curl to retry. This adds friction and makes the retry workflow invisible.

## What Changes

- Add a "Retry" action button on failed/blocked service executions in the service dashboard
- The button calls `POST /api/papers/:id/services/:serviceName/trigger` to re-run a specific service for a specific paper
- Show success/error feedback after triggering a retry
- Display the error message more prominently for failed executions so users can diagnose issues before retrying

## Capabilities

### New Capabilities
- `service-execution-retry`: UI controls for retrying failed/blocked service executions from the service dashboard, including per-execution action buttons and feedback

### Modified Capabilities

## Impact

- **Frontend**: `ServiceDashboard.vue` — add retry button and feedback to execution table rows
- **Backend**: No changes needed — `POST /api/papers/:id/services/:serviceName/trigger` endpoint already exists
- **API**: No new endpoints required
