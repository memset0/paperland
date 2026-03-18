## Why
Users need to monitor service execution status, configure concurrency, and view execution history.

## What Changes
- Implement ServiceDashboard.vue with service overview cards, execution history table with pagination and filters
- Short polling for real-time updates

## Capabilities
### New Capabilities
- `service-dashboard-ui`: Frontend service management page with live service status, execution history table

### Modified Capabilities
(none)

## Impact
- **Modified**: packages/frontend/src/views/ServiceDashboard.vue
