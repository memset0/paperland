## MODIFIED Requirements

### Requirement: Paper detail notes entry
The paper detail page SHALL present, for authenticated users, the single note document in two derived views: a left-panel document view with edit / split / render modes (see the `notes-walkthrough` capability) and a right-panel mind-map derived from the document's heading structure (see the `note-mindmap` capability). Opening a section for editing SHALL launch a floating editor window (see the `note-editor-window` capability). The right-panel notes card SHALL also provide a control that opens the **whole-document floating editor** directly (see the `note-editor-window` capability). The Kimi auto-summary card SHALL be placed **directly below** the notes card in the paper detail layout. Anonymous visitors SHALL see a login prompt instead of note content.

#### Scenario: Authenticated user sees notes entry
- **WHEN** an authenticated user opens a paper detail page
- **THEN** they SHALL see the note document view (left) and its heading-derived mind-map (right)

#### Scenario: Notes card opens the whole-document editor
- **WHEN** an authenticated user activates the open-editor control on the notes card
- **THEN** the whole-document floating editor SHALL open

#### Scenario: Kimi summary sits below the notes card
- **WHEN** the paper detail page is rendered
- **THEN** the Kimi auto-summary card SHALL appear directly below the notes card

#### Scenario: Anonymous visitor sees login prompt
- **WHEN** an anonymous visitor opens a paper detail page
- **THEN** the notes area SHALL prompt for login and SHALL NOT show note content
