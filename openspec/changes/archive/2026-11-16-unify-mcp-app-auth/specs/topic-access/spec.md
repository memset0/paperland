# Spec Delta

## REMOVED Requirements

### Requirement: User-bound Topic credentials
**Reason**: Topic-scoped credentials are replaced by account-wide Plugins services, managed on the Plugins page.
**Migration**: Active Topic tokens are converted into Plugins services named "Topic token <id>". Their key keeps working for MCP and Topic Git.

### Requirement: Topic scope does not expand personal access
**Reason**: There are no Topic-scoped credentials any more. A service acts as its owner, and Topic permissions still apply per Topic.
**Migration**: None. The converted services act with their owner's normal access.

## MODIFIED Requirements

### Requirement: Authenticated push audit
Every published push SHALL persist the actual Paperland user, authentication credential identifier, server time, old commit and new commit. Topic version history SHALL show the uploader and, when the credential is a Plugins service, the service name as the app the push came through. Git author/committer declarations SHALL remain separately viewable and SHALL NOT determine upload ownership. Recovering an interrupted publication SHALL preserve the original uploader identity and time.

#### Scenario: Forged Git author
- **WHEN** an editor pushes a commit naming someone else as Git author
- **THEN** the upload SHALL still be attributed to the authenticated editor

#### Scenario: Uploader account removed during interrupted publication
- **WHEN** the uploader's account is deleted before publication recovery completes
- **THEN** recovery SHALL preserve their immutable authenticated user ID and recorded name/time without requiring that account to be recreated

#### Scenario: Pushed through an app
- **WHEN** an editor pushes with the key of their service named "Codex"
- **THEN** the history entry SHALL show the editor as the pusher and "Codex" as the app

### Requirement: Topic management through MCP
Service keys and personal access through MCP SHALL support Topic listing/creation, reading, history, repository instructions, member management where permitted, and explicitly permitted Topic actions, all subject to the owner's permission in each Topic. MCP SHALL return usable repository and native application links without embedding secrets.

#### Scenario: Agent discovers the repository contract
- **WHEN** an authorized agent reads a Topic through MCP
- **THEN** it SHALL receive its current version, permission, repository URL and instructions for the required files
