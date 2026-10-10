# ui-language Specification

## Purpose
Defines the language and typography conventions for all user-facing text in the Paperland web frontend, so the interface reads consistently in English.

## Requirements

### Requirement: Frontend UI text is English
All user-facing text rendered by the web frontend SHALL be in English: visible template text, input placeholders, `title` / `aria-label` / tooltip text, toast messages, confirm and alert dialogs, inline error and status messages, labels of selectable options, empty states, relative times, and page titles. This SHALL NOT apply to user-generated content, model output, text returned by the backend, or source-code comments.

#### Scenario: No Chinese UI text remains
- **WHEN** the frontend source is searched for CJK characters
- **THEN** matches SHALL appear only in code comments, in parsing patterns for third-party text, and in test fixtures

#### Scenario: Toasts and confirmations are English
- **WHEN** a user copies a link, revokes a token, or deletes a reference link
- **THEN** the resulting toast or confirmation dialog SHALL be in English

### Requirement: Consistent UI typography
UI text SHALL use sentence case (only the first word capitalized, proper nouns such as Q&A, PDF, arXiv, Semantic Scholar, doc2x, Codex, Deep Research kept as written). In-progress states SHALL end with a single ellipsis character "…". Quoted names SHALL use straight double quotes, and colons and parentheses SHALL be ASCII. Confirmation dialogs SHALL be phrased as a full question that names the action and its consequence. The same concept SHALL use the same English term everywhere (e.g. "Follow up", "Add to question", "Free question", "Conversation view").

#### Scenario: In-progress button text
- **WHEN** a save is in progress
- **THEN** the button SHALL read "Saving…"

#### Scenario: Consistent term
- **WHEN** a Q&A entry has no template name
- **THEN** its fallback title SHALL read "Free question" in the Q&A list, the Q&A tree, the feed, and the paper detail page
