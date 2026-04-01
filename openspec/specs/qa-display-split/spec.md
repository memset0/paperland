## ADDED Requirements

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
