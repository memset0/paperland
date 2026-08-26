## ADDED Requirements

### Requirement: QA feed reuses live per-Result rendering
The `/qa` feed SHALL use the same Result tabs, precise lifecycle labels, Thinking timer, stable incremental Markdown preview, final canonical render, stream reconciliation, stop/retry authorization, and terminal errors as PaperDetail. Opening, closing, or collapsing a feed panel SHALL NOT control the underlying Service execution.

#### Scenario: Expand an actively streaming feed entry
- **WHEN** a viewer expands a feed card whose newest Result is streaming
- **THEN** the current persisted answer SHALL appear immediately and continue growing through live updates

#### Scenario: Read-only all-scope viewer
- **WHEN** a user views another user's streaming Result in all scope
- **THEN** live text and status SHALL be visible while stop/retry/delete controls remain hidden

#### Scenario: Feed timer and stream preserve card geometry
- **WHEN** an expanded feed Result moves from Thinking to streaming and then done
- **THEN** its timer/status SHALL use stable geometry, incremental output SHALL not remount the feed card, and completion SHALL perform one final canonical render

### Requirement: Feed polling remains a streaming fallback
The feed SHALL continue polling only its current page while any entry contains an active Result. Live subscriptions SHALL update discovered Results between polls; polling SHALL discover new Result identities, reconcile missed/terminal snapshots, and stop when no Result on the page is active.

#### Scenario: Live connection fails temporarily
- **WHEN** a Result SSE connection fails without a terminal event
- **THEN** current-page polling SHALL eventually reconcile its durable partial or terminal Result state without duplicating text

#### Scenario: All visible Results are terminal
- **WHEN** every Result on the current feed page is done, failed, or cancelled
- **THEN** the feed SHALL close active subscriptions and stop polling that page
