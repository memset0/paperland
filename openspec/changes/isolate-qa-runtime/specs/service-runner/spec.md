## ADDED Requirements

### Requirement: Pure-service callback receives exact execution identity
When ServiceRunner creates a pure-service execution, it SHALL make that exact execution id available to the corresponding callback before external work begins. QA SHALL use the supplied id for its new successful result instead of querying the latest execution for a paper.

#### Scenario: Concurrent QA on one paper
- **WHEN** several QA runs for the same paper execute concurrently
- **THEN** each callback SHALL receive its own execution id
- **AND** every successful result SHALL reference the id from its own callback

#### Scenario: Historical ambiguous links
- **WHEN** an old result shares or misidentifies an execution and no reliable mapping data exists
- **THEN** migration SHALL preserve the historical value rather than guess

### Requirement: QA remains a visible pure service
QA SHALL remain registered as a pure service, obey the existing QA concurrency/rate-limit configuration, and remain visible in the unified service list and execution history. It SHALL remain outside the paper dependency graph.

#### Scenario: Service dashboard lists QA
- **WHEN** an administrator views Services
- **THEN** QA SHALL continue to show unified pending/running counts and execution history

#### Scenario: QA execution completes
- **WHEN** a QA callback completes or throws
- **THEN** ServiceRunner SHALL continue to mark the execution done or failed using the common service lifecycle

