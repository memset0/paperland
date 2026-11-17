# Spec Delta

## ADDED Requirements

### Requirement: No pushes to archived Topics
Git `receive-pack` requests (advertisement and push) for an archived Topic SHALL be refused with HTTP 403 and a plain message that the Topic is archived and must be unarchived by its owner before pushing. Clone and fetch (`upload-pack`) SHALL keep working for readers.

#### Scenario: Push to archived Topic
- **WHEN** an editor pushes to an archived Topic
- **THEN** the push SHALL be rejected with the archived message and the published commit SHALL be unchanged

#### Scenario: Clone archived Topic
- **WHEN** a reader clones an archived Topic
- **THEN** the clone SHALL succeed
