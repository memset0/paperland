## MODIFIED Requirements

### Requirement: Service runner supports pure services
The service runner SHALL support registering and executing "pure" services that do not participate in the paper-bound dependency graph but use the same concurrency control and execution tracking infrastructure.

#### Scenario: Register pure service
- **WHEN** a service is registered with `type: 'pure'`
- **THEN** the service runner creates a semaphore and rate limiter based on its config
- **AND** the service does NOT appear in the dependency graph for `triggerForPaper()`

#### Scenario: Execute pure service
- **WHEN** `executePureService(serviceName, paperId, executeFn)` is called
- **THEN** the service runner acquires the semaphore slot, respects rate limiting
- **AND** creates a `service_executions` record tracking the lifecycle
- **AND** returns the execution ID

#### Scenario: Pure service appears in getServiceInfo
- **WHEN** `getServiceInfo()` is called
- **THEN** pure services appear in the list with their running/pending counts and max_concurrency
