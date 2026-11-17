# Spec Delta

## ADDED Requirements

### Requirement: Archive a Topic
The Topic owner SHALL be able to archive and unarchive a Topic. Archiving SHALL record the archive time, and unarchiving SHALL clear it. Non-owners SHALL NOT change the archive state. Archived Topics SHALL remain in Topic lists and SHALL be readable by everyone who could read them before, including history, documents and explicit paper import into the reader's own library. Lists and details SHALL include `archived_at` (null when not archived).

#### Scenario: Archived Topic stays listed
- **WHEN** the owner archives a Topic
- **THEN** the Topic SHALL still appear in the Topics list for its readers, marked "Archived"

#### Scenario: Archived Topics are listed separately
- **WHEN** a reader opens the web Topics list and some listed Topics are archived
- **THEN** archived Topics SHALL appear only in a separate "Archived" group with its count, not mixed with active Topics

#### Scenario: Non-owner cannot archive
- **WHEN** an editor who is not the owner tries to archive the Topic
- **THEN** the request SHALL be refused and nothing SHALL change

#### Scenario: Unarchive
- **WHEN** the owner unarchives an archived Topic
- **THEN** it SHALL be editable again by its editors

### Requirement: Topics list URL
The web Topics list SHALL live at `/topics`, and the sidebar and in-app links SHALL point there. The old `/research` list URL SHALL redirect to `/topics`, keeping its query string. Research history (`/research/history`) and old research sessions (`/research/:id`) SHALL keep their URLs.

#### Scenario: Old list link redirects
- **WHEN** a user opens `/research?new=1&seed_result=42`
- **THEN** the browser SHALL land on `/topics?new=1&seed_result=42` and the new-topic dialog SHALL open from that answer

### Requirement: Archived Topics are read-only
While a Topic is archived, its content SHALL NOT change: renaming SHALL be refused with an error saying the Topic is archived, and Git pushes SHALL be refused (see topic-git). Sharing, member and own-credential management SHALL keep working. The Topic page SHALL show an "Archived" notice and SHALL hide rename and other edit affordances while archived, and the owner SHALL see an Unarchive action.

#### Scenario: Rename refused
- **WHEN** an editor renames an archived Topic
- **THEN** the request SHALL fail with a message that the Topic is archived and the title SHALL stay unchanged

#### Scenario: Sharing still adjustable
- **WHEN** the owner changes the default access of an archived Topic
- **THEN** the change SHALL be applied
