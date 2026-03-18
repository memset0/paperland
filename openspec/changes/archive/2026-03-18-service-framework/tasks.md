## 1. Semaphore and Rate Limiter

- [x] 1.1 Create packages/backend/src/services/semaphore.ts — async semaphore with acquire/release for concurrency control
- [x] 1.2 Create packages/backend/src/services/rate_limiter.ts — per-service rate limiter that enforces cooldown between executions

## 2. Service Runner Core

- [x] 2.1 Create packages/backend/src/services/base_service.ts — PaperBoundService interface (name, depends_on, produces, execute) and PureService interface
- [x] 2.2 Create packages/backend/src/services/service_runner.ts — ServiceRunner class with service registration, concurrency pools, rate limiting
- [x] 2.3 Implement triggerForPaper(paperId) — resolve dependency graph, build topological execution order, execute services
- [x] 2.4 Implement dependency resolution: check produces already exist (skip), depends_on missing (auto-trigger upstream or mark blocked), wait for in-progress
- [x] 2.5 Implement execution status lifecycle — create/update service_executions records for each status transition
- [x] 2.6 Implement basic fields auto-fill logic — after service fetches metadata, update title/abstract/authors if empty

## 3. Paper Deduplication

- [x] 3.1 Create packages/backend/src/services/paper_dedup.ts — in-memory Map<string, Promise> for concurrent creation dedup
- [x] 3.2 Integrate dedup into paper creation flow in packages/backend/src/api/papers.ts

## 4. Service API Endpoints

- [x] 4.1 Create packages/backend/src/api/services.ts — GET /api/services (list registered services with config)
- [x] 4.2 Add GET /api/services/executions — paginated execution history, filterable by service_name and status
- [x] 4.3 Add GET /api/papers/:id/services — get service execution status for a specific paper
- [x] 4.4 Register service routes in packages/backend/src/index.ts

## 5. Integration

- [x] 5.1 Initialize ServiceRunner in server startup, load service configs from config.yml
- [x] 5.2 Update paper creation (POST /api/papers) to trigger services after create/bind
- [x] 5.3 Export ServiceRunner instance for use by concrete service implementations
