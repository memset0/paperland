## ADDED Requirements

### Requirement: Retry button for failed and blocked executions
The service dashboard execution history table SHALL display a retry action button for each execution with status `failed` or `blocked`. The button SHALL NOT appear for executions with status `done`, `running`, or `pending`.

#### Scenario: Retry button visible on failed execution
- **WHEN** a service execution has status `failed`
- **THEN** a retry icon button (RefreshCw) is displayed in the Actions column of that row

#### Scenario: Retry button visible on blocked execution
- **WHEN** a service execution has status `blocked`
- **THEN** a retry icon button (RefreshCw) is displayed in the Actions column of that row

#### Scenario: No retry button on successful execution
- **WHEN** a service execution has status `done`
- **THEN** no retry button is displayed for that row

### Requirement: Retry triggers single-service execution
When the user clicks the retry button, the system SHALL send `POST /api/papers/:paperId/services/:serviceName/trigger` to re-run only that specific service for that specific paper.

#### Scenario: User clicks retry on a failed arxiv_metadata_service execution
- **WHEN** user clicks the retry button on a failed execution for `arxiv_metadata_service` on paper 96
- **THEN** the system calls `POST /api/papers/96/services/arxiv_metadata_service/trigger`
- **THEN** the execution list refreshes immediately to show the new pending/running execution

### Requirement: Retry button loading state
The retry button SHALL show a loading spinner while the trigger request is in-flight and SHALL be disabled to prevent duplicate requests.

#### Scenario: Retry request in progress
- **WHEN** user clicks the retry button and the API request is pending
- **THEN** the button displays a spinning loader icon and is not clickable

#### Scenario: Retry request completes
- **WHEN** the trigger API request returns successfully
- **THEN** the button returns to its normal state and the execution list is refreshed

### Requirement: Retry error feedback
If the trigger API request fails, the system SHALL display the error message to the user.

#### Scenario: Trigger endpoint returns error
- **WHEN** the retry trigger request fails (e.g., network error or 404)
- **THEN** an error message is displayed near the button or as a notification
