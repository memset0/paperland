## Purpose

Protect shared Topics with per-Topic default access, explicit membership and user-attributed credentials, applying the same access rules to current content, history, MCP and Git.

## ADDED Requirements

### Requirement: Explicit Topic membership
A Topic SHALL have one owner, per-Topic general access (none/viewer/editor) and optional individual grants. Only the owner SHALL change sharing. Effective permission SHALL be the higher of the general and individual role; owner permission remains owner. Web, history, tags, MCP and Git SHALL enforce this same effective access, without a site-admin bypass or account-wide sharing switch.

#### Scenario: Viewer and editor permissions
- **WHEN** the owner shares a Private Topic with a viewer and an editor
- **THEN** both SHALL read current/history content and clone/pull
- **AND** only the editor and owner SHALL push

#### Scenario: Private Topic is not visible
- **WHEN** a non-member attempts to read a Topic or its history
- **THEN** no content or metadata SHALL be disclosed, including through MCP or Git

### Requirement: Per-Topic sharing policy and separate controls
Creation SHALL offer Private/Public and a default Viewer/Editor role for Public. Omission SHALL default to Private. Public SHALL permit only active signed-in users. Share SHALL manage permissions; separate Connect SHALL manage only the caller's credentials/instructions. Existing Topics SHALL retain prior individual grants and default to Private.

#### Scenario: Public editor and an explicit viewer
- **WHEN** a Topic defaults to editor and one active user has an explicit viewer grant
- **THEN** all those users SHALL edit with their own credentials, because editor is higher than the individual viewer grant

#### Scenario: Make a Public Topic Private
- **WHEN** its owner changes default access to none
- **THEN** users relying on the default SHALL immediately lose access across web/history/tags/MCP/Git, including with existing Topic tokens
- **AND** explicit grants SHALL remain and stored counters SHALL survive

#### Scenario: Remove an individual grant on a Public Topic
- **WHEN** the owner removes an individual member
- **THEN** that user SHALL retain only the public default permission, with no individual deny override; their credentials SHALL follow that current effective permission

#### Scenario: Counting a general-access user's call
- **WHEN** counting creates a default-role membership row
- **THEN** that row SHALL follow current general access and not become an individual grant
- **AND** removed grants SHALL preserve counts and fall back to general access

### Requirement: User-bound Topic credentials
Each member SHALL issue, list metadata for, rotate and revoke their own Topic credentials. Each credential SHALL bind one actual user and one Topic, work for both MCP and Git, and require a currently active user and valid membership on every request. The secret SHALL be shown only at issuance and SHALL NOT appear in logs or clone URLs.

#### Scenario: Editor uses their own agent
- **WHEN** an editor authenticates with their own Topic credential
- **THEN** MCP and Git SHALL act as the editor within that Topic's permission scope
- **AND** the owner's credentials SHALL NOT be required

#### Scenario: Membership or credential revoked
- **WHEN** a credential is revoked/rotated, its user becomes inactive, or effective Topic access is lost
- **THEN** subsequent MCP/Git requests using the old authorization SHALL fail

### Requirement: Topic scope does not expand personal access
Topic credentials SHALL access only their bound Topic and allowed research tools over shared paper data. They SHALL NOT manage unrelated Topics, expose private owner/member tags, notes, Q&A or credentials, or invoke unrestricted paper mutation tools. Explicit entry import SHALL act on the credential user's own library, including recognized arXiv-paper URL entries without broadening generic link scraping.

#### Scenario: Cross-Topic or private-data access
- **WHEN** a Topic credential requests another Topic or unrelated private data
- **THEN** the operation SHALL be refused without disclosing that data

### Requirement: Authenticated push audit
Every published push SHALL persist the actual Paperland user, authentication credential identifier, server time, old commit and new commit. Git author/committer declarations SHALL remain separately viewable and SHALL NOT determine upload ownership. Recovering an interrupted publication SHALL preserve the original uploader identity and time.

#### Scenario: Forged Git author
- **WHEN** an editor pushes a commit naming someone else as Git author
- **THEN** the upload SHALL still be attributed to the authenticated editor

#### Scenario: Uploader account removed during interrupted publication
- **WHEN** the uploader's account is deleted before publication recovery completes
- **THEN** recovery SHALL preserve their immutable authenticated user ID and recorded name/time without requiring that account to be recreated

### Requirement: Topic management through MCP
Personal credentials SHALL support Topic listing/creation and permitted member/credential management. Topic credentials SHALL read their bound Topic, history, repository instructions and member-visible metadata, and support explicitly permitted Topic actions. MCP SHALL return usable repository and native application links without embedding secrets.

#### Scenario: Agent discovers the repository contract
- **WHEN** an authorized agent reads a Topic through MCP
- **THEN** it SHALL receive its current version, permission, repository URL and instructions for the required files

### Requirement: Selected-document MCP reading
get_topic SHALL optionally return only a selected authorized document and its numbered references, or metadata without document bodies. Default reads SHALL retain the complete prior shape. Filtering SHALL not bypass Topic/history permissions or allow arbitrary repository paths.

#### Scenario: Read a long wiki efficiently
- **WHEN** a Topic agent requests document=pages/rq6.md or metadata_only=true
- **THEN** unrelated page bodies SHALL be omitted and current version/permission/number metadata SHALL remain available
