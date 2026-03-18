## Context

The architecture docs define two service types: paper-bound (participates in dependency graph) and pure (manual trigger). The service runner needs to manage concurrency, rate limiting, and dependency resolution independently per service. See `docs/frontend-architecture.md` section 3 for full specification.

## Goals / Non-Goals

**Goals:**
- ServiceRunner with per-service concurrency pools and rate-limit cooldown
- PaperBoundService abstraction with depends_on/produces
- Automatic dependency graph resolution when services are triggered for a paper
- Status lifecycle: pending → waiting → running → done/failed/blocked
- Paper creation deduplication via in-memory Map
- API endpoints for service status listing and execution history

**Non-Goals:**
- Implementing any concrete service (arxiv, s2, etc.) — separate changes
- Frontend service dashboard UI — separate change
- WebSocket/SSE for real-time updates — using short polling per design

## Decisions

### 1. ServiceRunner as singleton class

One `ServiceRunner` instance manages all services. Each service gets its own concurrency semaphore and rate-limit timer. The runner resolves dependency graphs and orchestrates execution.

```typescript
class ServiceRunner {
  private services: Map<string, ServiceDefinition>
  private semaphores: Map<string, Semaphore>
  private lastExecution: Map<string, number>  // for rate limiting

  registerService(def: ServiceDefinition): void
  triggerForPaper(paperId: number): Promise<void>  // trigger all applicable services
  executeService(serviceName: string, paperId: number): Promise<void>
}
```

### 2. Dependency resolution algorithm

When services are triggered for a paper:
1. Collect all registered paper-bound services
2. For each service, check if all `produces` keys already exist on the paper → skip if yes
3. Check if `depends_on` keys exist → if missing, find which service produces them
4. Build a DAG of execution order
5. Execute services in topological order, respecting concurrency limits

### 3. Semaphore-based concurrency

Each service has a semaphore initialized with `max_concurrency` from config. When a service execution starts, it acquires a slot; when done, releases it. If the semaphore is full, the execution waits in a queue.

### 4. Rate limiting via timestamp tracking

Track `lastExecution[serviceName]` timestamp. Before executing, check if `Date.now() - lastExecution >= rate_limit_interval * 1000`. If not, sleep for the difference. This is per-service and doesn't block other services.

### 5. Paper dedup via in-memory Map

```typescript
const initializingPapers = new Map<string, Promise<Paper>>()
// key: "arxiv:1706.03762" or "corpus:123456789"
```

On paper creation: check map → if exists, await the existing promise. Otherwise, set the promise and proceed.

## Risks / Trade-offs

- **[Risk] In-memory dedup lost on restart** → Acceptable for a single-process personal app. The DB unique constraints are the ultimate safety net.
- **[Risk] Semaphore fairness** → Simple FIFO queue is sufficient for this scale.
