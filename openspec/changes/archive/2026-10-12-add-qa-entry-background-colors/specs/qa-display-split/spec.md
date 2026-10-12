## ADDED Requirements

### Requirement: Paper QA background control
Each visible QA entry on PaperDetail SHALL offer an authenticated viewer a compact palette/clear control and SHALL render the current viewer's saved background in collapsed and expanded states.

#### Scenario: Color a preset entry
- **WHEN** a logged-in viewer colors a Preset Q&A entry
- **THEN** the shared QA content SHALL remain unchanged and only that viewer's presentation SHALL update

#### Scenario: Anonymous paper viewer
- **WHEN** an anonymous viewer sees Preset Q&A
- **THEN** no color control or private color SHALL appear

