## ADDED Requirements

### Requirement: Bilingual text component
The frontend SHALL provide a reusable `BilingualText` component that accepts a single plain-text string as input and, by default, displays only the original English text. The component SHALL render the input as plain text (preserving line breaks via `white-space: pre-wrap`) and SHALL NOT render it as Markdown. Below the text the component SHALL show a small "translate" button.

#### Scenario: Default shows English only
- **WHEN** `BilingualText` is rendered with a `text` prop
- **THEN** it SHALL display the original English text and a small translate button below it
- **AND** SHALL NOT show any Chinese translation until the button is clicked

#### Scenario: Plain-text rendering, no Markdown
- **WHEN** the input text contains Markdown-like characters (e.g. `**bold**`) and newlines
- **THEN** the component SHALL display them as literal text with line breaks preserved, not as rendered Markdown

### Requirement: On-demand translation gated to logged-in users
The component SHALL trigger translation only when the user clicks the translate button (never automatically). Clicking SHALL call the translation API with the component's text as input. Translation SHALL be available only to logged-in users: when the current user is not authenticated, clicking the button SHALL prompt the user to log in (via the existing login prompt) and SHALL NOT call the translation API.

#### Scenario: Logged-in user translates on click
- **WHEN** a logged-in user clicks the translate button
- **THEN** the component SHALL call `POST /api/translate` with the component's text and request a translation

#### Scenario: Not-logged-in user is prompted to log in
- **WHEN** a user who is not authenticated clicks the translate button
- **THEN** the component SHALL open the login prompt and SHALL NOT call the translation API

#### Scenario: Loading state during translation
- **WHEN** a translation request is in flight
- **THEN** the button SHALL show a loading indicator and SHALL be disabled until the request resolves

### Requirement: Translated Chinese appended below the original
After a successful translation, the component SHALL append the Chinese translation below the original English text (the English SHALL remain visible). The translation SHALL be introduced by a compact header row containing a "Translation" label with the hide/show and re-translate controls inline to its right (small/compact buttons). The component SHALL allow re-translating (overwriting the cached result via the API's force flag) and SHALL allow hiding/showing the appended translation.

#### Scenario: Append Chinese below English with inline controls
- **WHEN** translation completes successfully
- **THEN** the Chinese translation SHALL be displayed below the original English text (English still shown), preceded by a header row whose "Translation" label has the hide/show and re-translate controls on the same line to its right

#### Scenario: Re-translate refreshes the translation
- **WHEN** the user triggers "re-translate" on an already-translated text
- **THEN** the component SHALL call the API with the force flag and replace the displayed Chinese with the new result

### Requirement: Previously-translated text is expanded by default
When the component mounts (or its text changes) for a logged-in user, it SHALL ask the backend whether the text already has a cached translation (a peek that does NOT trigger a new translation). If one exists, the component SHALL display it expanded by default; otherwise it SHALL show only the original text with the translate button. The frontend SHALL NOT need to compute the content hash itself — the backend determines cache membership.

#### Scenario: Already-translated text shows expanded on load
- **WHEN** a logged-in user opens content whose text was translated before
- **THEN** the component SHALL show the cached Chinese translation expanded by default, without calling the AI model

#### Scenario: Never-translated text shows collapsed on load
- **WHEN** content whose text has no cached translation is shown
- **THEN** the component SHALL show only the original text and the translate button (no translation, no AI call)

### Requirement: Paper detail abstract uses the bilingual component
The paper detail page SHALL render the paper's `abstract` using the `BilingualText` component (in both the wide and narrow layouts), so the abstract supports on-demand English/Chinese bilingual display.

#### Scenario: Abstract is bilingual-capable
- **WHEN** the paper detail page is viewed for a paper that has an abstract
- **THEN** the abstract SHALL be rendered via `BilingualText`, showing the English abstract with a translate button below it
