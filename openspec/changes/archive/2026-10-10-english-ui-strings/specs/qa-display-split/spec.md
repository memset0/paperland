## MODIFIED Requirements

### Requirement: Preset QA card has generate-all button
The Preset Q&A card header SHALL include the "Generate all" button when there are ungenerated preset questions, along with a polling status indicator.

#### Scenario: Some template questions not yet generated
- **WHEN** the Preset Q&A card is displayed and some preset questions have no results
- **THEN** the "Generate all" button appears in the card header

### Requirement: Each card has independent expand/collapse-all controls
Each card (Preset Q&A and User Q&A) SHALL have its own "Expand all" and "Collapse all" buttons that only affect questions within that card.

#### Scenario: User clicks expand-all on Template QA card
- **WHEN** user clicks "Expand all" on the Preset Q&A card
- **THEN** only preset QA questions expand; user QA questions remain unchanged

### Requirement: QA generation requires login
Triggering any LLM action on the paper detail page — generating or regenerating preset Q&A, submitting a user question, regenerating, or deleting a result — SHALL require an authenticated user. For anonymous visitors these controls SHALL prompt for login rather than initiate an LLM call.

#### Scenario: Anonymous user attempts to generate template QA
- **WHEN** an anonymous visitor activates the "Generate all" or a single preset generate control
- **THEN** the system SHALL prompt for login and SHALL NOT trigger any LLM call

#### Scenario: Anonymous user attempts a free question
- **WHEN** an anonymous visitor attempts to submit a user question
- **THEN** the system SHALL prompt for login and SHALL NOT create a QA entry

#### Scenario: Authenticated user generates normally
- **WHEN** an authenticated user triggers preset or user QA
- **THEN** the system SHALL proceed, attributing the user QA entry to that user
