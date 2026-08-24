## MODIFIED Requirements

### Requirement: Preset QA and User QA are rendered in separate cards
The QAList component SHALL render two independent card containers: one for preset QA entries (config-ordered) and one for user QA entries (newest-first). Each card SHALL have its own header with title and expand/collapse-all controls.

#### Scenario: Both template and free QA exist
- **WHEN** the paper has both preset QA entries and user QA entries
- **THEN** two separate cards are displayed: "Preset Q&A" card first, "User Q&A" card second

#### Scenario: Only template QA exists
- **WHEN** the paper has preset QA entries but no user QA entries
- **THEN** only the Preset Q&A card is displayed

#### Scenario: Only free QA exists
- **WHEN** the paper has user QA entries but no preset QA entries
- **THEN** only the User Q&A card is displayed

### Requirement: Card ordering on paper detail page
The paper detail page SHALL display content cards in this order: Kimi summary (if available) → Preset Q&A → User Q&A.

#### Scenario: All three cards present
- **WHEN** the paper has Kimi summary, preset QA, and user QA
- **THEN** cards appear in order: Kimi summary, Preset Q&A, User Q&A

### Requirement: Preset QA card has generate-all button
The Preset Q&A card header SHALL include the "一键生成" button when there are ungenerated preset questions, along with a polling status indicator.

#### Scenario: Some template questions not yet generated
- **WHEN** the Preset Q&A card is displayed and some preset questions have no results
- **THEN** the "一键生成" button appears in the card header

### Requirement: Each card has independent expand/collapse-all controls
Each card (Preset Q&A and User Q&A) SHALL have its own "全部展开" and "全部折叠" buttons that only affect questions within that card.

#### Scenario: User clicks expand-all on Template QA card
- **WHEN** user clicks "全部展开" on the Preset Q&A card
- **THEN** only preset QA questions expand; user QA questions remain unchanged

### Requirement: Preset QA is public, User QA is owner-scoped
On the paper detail page, the Preset Q&A card SHALL be visible to everyone, including anonymous visitors. The User Q&A card SHALL display only the current authenticated user's user QA entries; anonymous visitors and other users SHALL NOT see a user's user QA entries.

#### Scenario: Anonymous visitor sees only template QA
- **WHEN** an anonymous visitor opens a paper detail page that has both preset and user QA
- **THEN** the Preset Q&A card SHALL be shown with its results, and the User Q&A card SHALL show no entries

#### Scenario: User sees only their own free QA
- **WHEN** an authenticated user opens a paper detail page
- **THEN** the User Q&A card SHALL show only that user's user QA entries for the paper

#### Scenario: Another user's free QA hidden
- **WHEN** user B opens a paper for which user A created user QA entries
- **THEN** user B SHALL NOT see user A's user QA entries

### Requirement: QA generation requires login
Triggering any LLM action on the paper detail page — generating or regenerating preset Q&A, submitting a user question, regenerating, or deleting a result — SHALL require an authenticated user. For anonymous visitors these controls SHALL prompt for login rather than initiate an LLM call.

#### Scenario: Anonymous user attempts to generate template QA
- **WHEN** an anonymous visitor activates the "一键生成" or a single preset generate control
- **THEN** the system SHALL prompt for login and SHALL NOT trigger any LLM call

#### Scenario: Anonymous user attempts a free question
- **WHEN** an anonymous visitor attempts to submit a user question
- **THEN** the system SHALL prompt for login and SHALL NOT create a QA entry

#### Scenario: Authenticated user generates normally
- **WHEN** an authenticated user triggers preset or user QA
- **THEN** the system SHALL proceed, attributing the user QA entry to that user
