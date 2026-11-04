## ADDED Requirements

### Requirement: Completion feed endpoint
The backend SHALL provide `GET /api/notifications/completions` for signed-in users. It SHALL return `{ now, items }` where `now` is the current server time (ISO 8601) and `items` lists, in finish order, the caller's Q&A answers (results requested by the caller, of non-deleted entries) and Deep Research rounds (agent steps of the caller's sessions) whose status is `done` or `failed` and whose finish time is strictly after the `since` query parameter. Without `since` the endpoint SHALL return no items. Q&A items SHALL carry the result, entry and paper ids, the paper title, the question title (free prompt or template name), the model and the status; research items SHALL carry the step and session ids, the session title and the status. Other users' work, cancelled runs and title edits SHALL NOT be listed. Signed-out requests SHALL be rejected.

#### Scenario: First call returns a cursor only
- **WHEN** a signed-in client calls the endpoint without `since`
- **THEN** the response has the server time and no items

#### Scenario: Finished answer after the cursor
- **WHEN** the user's answer finishes after the cursor the client sent
- **THEN** the next call lists that answer once with its paper, question title and status

#### Scenario: Other users' work
- **WHEN** another user's answer or research round finishes
- **THEN** it is not listed for this user

### Requirement: Global completion notices
While a user is signed in (outside the embed side panel), the app SHALL poll the completion feed from any page about every 5 s while the browser tab is visible, SHALL NOT poll while the tab is hidden, and SHALL check immediately when the tab becomes visible again, announcing what finished meanwhile. It SHALL show one notice per new completion at the bottom center of the screen, like the "LaTeX copied" notice. A notice SHALL say whether it is a Q&A answer or a Deep Research round, whether it finished or failed, and its title (and the paper title for Q&A). Completions that finished before the app was opened SHALL NOT be announced. Notices SHALL disappear on their own after a few seconds.

#### Scenario: Answer finishes on another page
- **WHEN** the user asked a question on paper A and is now browsing the paper list when the answer finishes
- **THEN** a notice "Answer ready" with the question and paper title appears at the bottom center

#### Scenario: Back from another browser tab
- **WHEN** an answer finishes while the user is in another browser tab and they switch back
- **THEN** no request was made while hidden, and the notice appears right after switching back

#### Scenario: Research round finishes
- **WHEN** a Deep Research round of the user finishes while they read a paper
- **THEN** a notice with the research title appears

### Requirement: Notices jump to the result
Clicking a notice SHALL navigate to the finished item and dismiss the notice; Ctrl/⌘-click (or middle-click) SHALL open it in a new browser tab instead. A research notice SHALL open the research session. A Q&A notice SHALL open the paper page and then: if the conversation view is shown there (desktop conversation layouts, or the phone Ask section), open the answer's thread in the conversation view — activating the tab whose thread ends at that answer, or opening a new tab when there is none; otherwise reveal the entry in the Q&A list, expanded, with that answer selected. The paper deep link `?qa=<entry>&result=<id>&thread=1` SHALL behave the same way, so a new tab lands identically.

#### Scenario: Conversation view shown
- **WHEN** the user clicks a Q&A notice while the conversation view is shown and no tab ends at that answer
- **THEN** a new conversation tab with that answer's thread becomes active

#### Scenario: Existing tab
- **WHEN** a conversation tab already ends at that answer
- **THEN** that tab is activated and no new tab is created

#### Scenario: Conversation view not shown
- **WHEN** the user clicks a Q&A notice on the split layout
- **THEN** the Q&A list scrolls to the entry, expands it and selects that answer

#### Scenario: Open in a new tab
- **WHEN** the user Ctrl-clicks a notice
- **THEN** the target opens in a new browser tab and the current page does not change
