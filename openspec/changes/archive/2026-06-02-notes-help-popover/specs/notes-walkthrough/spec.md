## ADDED Requirements

### Requirement: Help affordance in the note function bar
The left-panel note view's function bar SHALL include a help control (a "?" icon). Activating it SHALL open a help dialog about the note system. The dialog SHALL explain at least:
- **Mind-map syntax**: that Markdown headings become mind-map nodes nested by relative heading depth, that a heading's text below it is the node's content, and that a **leading blockquote** (`>`) at the start of a node's content becomes a read-only **content node** (plain text, image, or formula) — with consecutive leading blockquotes producing multiple content nodes.
- **PDF image capture**: that the PDF viewer's Crop/screenshot tool lets the user drag a region which is captured to an image, uploaded to the image host, and copied as a paste-ready Markdown image link wrapped in a `paperland://…?pdf=…` anchor.
The dialog SHALL be dismissible.

#### Scenario: Help control is present
- **WHEN** the left note panel is shown
- **THEN** its function bar SHALL include a "?" help control

#### Scenario: Opening the help dialog
- **WHEN** the user activates the help control
- **THEN** a help dialog SHALL open describing the mind-map heading/blockquote syntax and the PDF region image-capture

#### Scenario: Dismissing the help dialog
- **WHEN** the user closes the help dialog
- **THEN** it SHALL be dismissed and the note panel SHALL be unaffected
