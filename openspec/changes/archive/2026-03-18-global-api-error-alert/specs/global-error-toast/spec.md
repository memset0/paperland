## ADDED Requirements

### Requirement: API errors trigger global toast notification
When any API request made through `api/client.ts` returns a non-ok response, the system SHALL dispatch an error event containing the error message, in addition to throwing the Error as before.

#### Scenario: API request returns 4xx/5xx
- **WHEN** a request via `api.get/post/put/delete` receives a non-ok HTTP response
- **THEN** the system SHALL dispatch a global error event with the parsed error message AND throw the Error to the caller as before

#### Scenario: Network failure
- **WHEN** a request fails due to network error (fetch throws)
- **THEN** the system SHALL dispatch a global error event with message "网络错误，请检查连接" AND re-throw the original error

### Requirement: GlobalAlert component displays floating red toast
The system SHALL render a `GlobalAlert` component at the top level of the app that listens for error events and displays them as red floating toast notifications at the top of the viewport.

#### Scenario: Error event received
- **WHEN** a global error event is dispatched
- **THEN** a red toast notification SHALL appear at the top-center of the page, displaying the error message text

#### Scenario: Toast auto-dismiss
- **WHEN** a toast has been visible for 5 seconds
- **THEN** it SHALL automatically fade out and be removed

#### Scenario: Toast manual close
- **WHEN** the user clicks the close (X) button on a toast
- **THEN** the toast SHALL immediately be removed

#### Scenario: Multiple concurrent errors
- **WHEN** multiple error events are dispatched in quick succession
- **THEN** toasts SHALL stack vertically (newest at bottom), with a maximum of 5 visible at once; when a 6th arrives, the oldest SHALL be removed

### Requirement: Global alert does not interfere with existing error handling
The global toast mechanism SHALL be purely additive — it SHALL NOT suppress, catch, or modify errors thrown by the API client. Existing per-page error handling SHALL continue to function unchanged.

#### Scenario: Caller catches the error
- **WHEN** a caller wraps an API call in try/catch and handles the error locally
- **THEN** both the caller's error handling AND the global toast SHALL execute independently
