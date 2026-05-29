# qa-display-split Specification

## Purpose
The paper detail page Q&A area renders Template Q&A and Free Q&A as separate, independently-controlled cards.
## Requirements
### Requirement: Template QA and Free QA are rendered in separate cards
The QAList component SHALL render two independent card containers: one for template QA entries (config-ordered) and one for free QA entries (newest-first). Each card SHALL have its own header with title and expand/collapse-all controls.

#### Scenario: Both template and free QA exist
- **WHEN** the paper has both template QA entries and free QA entries
- **THEN** two separate cards are displayed: "Template Q&A" card first, "Free Q&A" card second

#### Scenario: Only template QA exists
- **WHEN** the paper has template QA entries but no free QA entries
- **THEN** only the Template Q&A card is displayed

#### Scenario: Only free QA exists
- **WHEN** the paper has free QA entries but no template QA entries
- **THEN** only the Free Q&A card is displayed

### Requirement: Card ordering on paper detail page
The paper detail page SHALL display content cards in this order: Kimi summary (if available) → Template Q&A → Free Q&A.

#### Scenario: All three cards present
- **WHEN** the paper has Kimi summary, template QA, and free QA
- **THEN** cards appear in order: Kimi summary, Template Q&A, Free Q&A

### Requirement: All QA questions default to collapsed state
All QA question `<details>` elements SHALL render in collapsed (closed) state on page load, regardless of any previously stored localStorage state.

#### Scenario: Page load with existing localStorage state
- **WHEN** a user navigates to a paper detail page that has prior collapse state in localStorage
- **THEN** all QA questions are displayed in collapsed state

#### Scenario: User manually toggles a question
- **WHEN** a user clicks on a question title to expand it
- **THEN** that question expands to show full content; clicking again collapses it

### Requirement: Question title truncation in collapsed mode
In collapsed (summary) mode, question titles SHALL be truncated to a single line with ellipsis.

#### Scenario: Long question title in collapsed state
- **WHEN** a QA entry is collapsed and its title exceeds one line
- **THEN** the title is truncated with ellipsis (line-clamp-1)

### Requirement: Full content display in expanded mode
In expanded mode, QA answer content SHALL display with natural word-wrap allowing multiple lines. Line break characters in the content SHALL NOT be rendered as visual line breaks; content flows as a single paragraph that wraps based on container width.

#### Scenario: Expanded QA entry with long answer
- **WHEN** a QA entry is expanded
- **THEN** the full answer text is displayed, wrapping naturally at container width

### Requirement: Template QA card has generate-all button
The Template Q&A card header SHALL include the "一键生成" button when there are ungenerated template questions, along with a polling status indicator.

#### Scenario: Some template questions not yet generated
- **WHEN** the Template Q&A card is displayed and some template questions have no results
- **THEN** the "一键生成" button appears in the card header

### Requirement: Each card has independent expand/collapse-all controls
Each card (Template Q&A and Free Q&A) SHALL have its own "全部展开" and "全部折叠" buttons that only affect questions within that card.

#### Scenario: User clicks expand-all on Template QA card
- **WHEN** user clicks "全部展开" on the Template Q&A card
- **THEN** only template QA questions expand; free QA questions remain unchanged

### Requirement: Template QA is public, Free QA is owner-scoped
On the paper detail page, the Template Q&A card SHALL be visible to everyone, including anonymous visitors. The Free Q&A card SHALL display only the current authenticated user's free QA entries; anonymous visitors and other users SHALL NOT see a user's free QA entries.

#### Scenario: Anonymous visitor sees only template QA
- **WHEN** an anonymous visitor opens a paper detail page that has both template and free QA
- **THEN** the Template Q&A card SHALL be shown with its results, and the Free Q&A card SHALL show no entries

#### Scenario: User sees only their own free QA
- **WHEN** an authenticated user opens a paper detail page
- **THEN** the Free Q&A card SHALL show only that user's free QA entries for the paper

#### Scenario: Another user's free QA hidden
- **WHEN** user B opens a paper for which user A created free QA entries
- **THEN** user B SHALL NOT see user A's free QA entries

### Requirement: QA generation requires login
Triggering any LLM action on the paper detail page — generating or regenerating template Q&A, submitting a free question, regenerating, or deleting a result — SHALL require an authenticated user. For anonymous visitors these controls SHALL prompt for login rather than initiate an LLM call.

#### Scenario: Anonymous user attempts to generate template QA
- **WHEN** an anonymous visitor activates the "一键生成" or a single template generate control
- **THEN** the system SHALL prompt for login and SHALL NOT trigger any LLM call

#### Scenario: Anonymous user attempts a free question
- **WHEN** an anonymous visitor attempts to submit a free question
- **THEN** the system SHALL prompt for login and SHALL NOT create a QA entry

#### Scenario: Authenticated user generates normally
- **WHEN** an authenticated user triggers template or free QA
- **THEN** the system SHALL proceed, attributing the free QA entry to that user

