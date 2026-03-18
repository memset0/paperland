## Why

All data fetching (arxiv, semantic scholar, PDF parsing) and Q&A operations are modeled as services. Before any service can be implemented, we need the service runner infrastructure: concurrency control, rate limiting, dependency graph resolution, status tracking, and the paper-bound service abstraction (depends_on/produces).

## What Changes

- Create `ServiceRunner` class that manages per-service concurrency pools and rate limiting
- Create `PaperBoundService` base class with `depends_on`/`produces` declarations
- Implement dependency graph resolver: auto-trigger dependent services, wait for dependencies, detect blocked state
- Implement paper creation deduplication (in-memory lock to prevent concurrent duplicate creation)
- Add service status tracking API endpoints (list services, execution history with pagination)
- Add service status polling API for frontend real-time updates

## Capabilities

### New Capabilities
- `service-runner`: Service execution engine with per-service concurrency pools, rate limiting (cooldown interval), and execution status lifecycle (pending → waiting → running → done/failed/blocked)
- `service-dependency-graph`: Paper-bound service dependency resolution based on depends_on/produces declarations, with auto-trigger of upstream services and recursive dependency resolution
- `paper-dedup`: In-memory lock mechanism to prevent duplicate paper creation from concurrent requests

### Modified Capabilities

(none)

## Impact

- **New files**: `packages/backend/src/services/service_runner.ts`, `packages/backend/src/services/base_service.ts`, `packages/backend/src/api/services.ts`
- **Modified**: `packages/backend/src/index.ts` (register service routes), `packages/backend/src/api/papers.ts` (add dedup + trigger services on create)
- **No new external dependencies**
