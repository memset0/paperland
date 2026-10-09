## Purpose

Serialize local frontend builds across concurrent agents on one machine, queue waiting build requests, and coalesce queued requests for the same output into a single build.

## ADDED Requirements

### Requirement: Single build entry point
The repository SHALL provide `bun run build:frontend` (backed by `scripts/build-frontend.sh`) as the entry point for building the frontend. By default it SHALL build into `packages/frontend/dist`; with `--out-dir <dir>` it SHALL build into that directory instead. Agents SHALL use this entry point instead of invoking `vite build` directly.

#### Scenario: Default build target
- **WHEN** an agent runs `bun run build:frontend` with no other build running or queued
- **THEN** the frontend SHALL be built into `packages/frontend/dist` immediately and the command SHALL exit with the build's exit status

### Requirement: Builds never run concurrently
At most one frontend build started through the entry point SHALL run on the machine at any time, regardless of output directory. A request arriving while a build runs SHALL wait in the queue. The lock SHALL be released automatically when the building process exits, including when it is killed.

#### Scenario: Second request waits
- **WHEN** a build is running and another agent runs `bun run build:frontend`
- **THEN** the second command SHALL report that it is queued and SHALL NOT start `vite build` until the running build finishes

#### Scenario: Killed build does not block the queue
- **WHEN** the running build's process is killed
- **THEN** the next queued request SHALL be able to start without manual cleanup

### Requirement: Queued requests are coalesced
Each request SHALL be registered with an increasing sequence number per output directory. A build SHALL cover every request for its output directory registered before the build starts. When a queued request obtains the lock and a build that covers it has already run, it SHALL NOT build again: it SHALL exit with that build's exit status and point to its log.

#### Scenario: Three requests while building
- **WHEN** a build A is running and requests B, C, and D for the same output directory are queued
- **THEN** after A finishes exactly one further build SHALL run, covering B, C, and D, and all three commands SHALL exit with that build's status

#### Scenario: Different output directories are not merged
- **WHEN** a request for `packages/frontend/dist` and a request with `--out-dir /tmp/x` are both queued
- **THEN** each SHALL get its own build, run one after the other

#### Scenario: Failed build is shared by its covered requests
- **WHEN** the build covering queued requests fails
- **THEN** those requests SHALL exit non-zero with the failing build's log path, and a request registered after that build started SHALL trigger a new build
