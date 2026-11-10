## MODIFIED Requirements

### Requirement: Start research from a QA answer
Every QA Result the viewer can see SHALL offer a "Create topic" action opening Topic creation with a seed snapshot of the source paper id/title, question, answer and Result id. Creating that Topic SHALL initialize its report from the snapshot without launching a model round. Later edits or deletion of the source QA SHALL NOT change the Topic's committed seed content. Existing legacy sessions and their seed snapshots SHALL remain readable.

#### Scenario: Seed is a snapshot
- **WHEN** a Topic is created from QA Result 42 and Result 42 is later deleted
- **THEN** the Topic's initial committed report SHALL retain the copied question and answer

### Requirement: Research pages
The sidebar's existing research entry SHALL be labeled "Topics" and link to `/research`, a Topics management page using AppPage. Legacy sessions SHALL remain listed at `/research/history` with their prior title, excerpt, round count, status, update time and mine/all scope. Existing `/research/:id` detail links SHALL retain their step timeline, report/list versions and legacy session tools. Topic details SHALL use a distinct `/topics/:id` route to avoid collisions with historical session IDs. New research creation from primary navigation SHALL create Topics rather than automatic model rounds.

#### Scenario: Navigate to research
- **WHEN** a logged-in user clicks "Topics" at the original Research sidebar location
- **THEN** `/research` SHALL show accessible Topics and a "New topic" action

#### Scenario: Newest round first on desktop
- **WHEN** the owner opens a legacy session with three rounds on a wide screen
- **THEN** its detail page SHALL continue to show the input at the top, then round 3, round 2, round 1

#### Scenario: Round duration is shown
- **WHEN** a legacy round started at 10:00:00 and finished at 10:03:12
- **THEN** its timeline SHALL still show `3m 12s`

#### Scenario: Access existing history
- **WHEN** a user follows an existing `/research/:id` link or opens Research history from Topics
- **THEN** authorized legacy content SHALL remain accessible after its one-time Topic copy, without deleting or altering the source records
