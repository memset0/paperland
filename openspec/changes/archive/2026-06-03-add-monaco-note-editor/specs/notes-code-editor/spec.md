## ADDED Requirements

### Requirement: Monaco-based Markdown editing surface

All note editing surfaces SHALL use a Monaco code editor configured for the
Markdown language in place of a plain `<textarea>`. This applies to both the
floating editor windows (section and whole-document, see the
`note-editor-window` capability) and the left-panel edit/split editor (see the
`notes-walkthrough` capability). The two surfaces SHALL share a single editor
component so they behave identically. The editor SHALL be bound to the same note
content as before (two-way), writing changes back to the shared document through
the same path the textarea used.

#### Scenario: Floating window uses the Monaco editor

- **WHEN** a user opens a section or whole-document floating editor window
- **THEN** the editing area SHALL be the Monaco Markdown editor, not a plain
  textarea, bound to that window's content

#### Scenario: Left-panel edit/split uses the Monaco editor

- **WHEN** the user switches the left panel into edit or split mode
- **THEN** the editing area SHALL be the Monaco Markdown editor, not a plain
  textarea, bound to the whole-document content

#### Scenario: Both surfaces share one editor component

- **WHEN** note editing appears in either a floating window or the left panel
- **THEN** both SHALL be rendered by the same shared Monaco editor component with
  the same editing behavior

### Requirement: Markdown syntax highlighting

The note editor SHALL apply Markdown syntax highlighting to its content —
distinctly styling at least headings, emphasis (bold/italic), inline and fenced
code, list markers, blockquotes, and links — so Markdown structure is visually
distinguishable while editing.

#### Scenario: Markdown tokens are highlighted

- **WHEN** a note contains Markdown such as headings, `**bold**`, fenced code,
  list items, blockquotes, and links
- **THEN** the editor SHALL render those tokens with syntax highlighting rather
  than as uniform plain text

#### Scenario: Image-in-link anchors highlight consistently

- **WHEN** a note contains an image-in-link anchor of the form
  `[![alt](imgUrl)](linkUrl)` (as produced by the PDF-region / image-host anchors)
- **THEN** the editor SHALL highlight the whole anchor as a link with matching
  opening and closing delimiters, rather than coloring only the opening bracket
  and leaving the trailing `](linkUrl)` as plain text

### Requirement: LaTeX math highlighting

Because notes render math via KaTeX, the editor's Markdown highlighting SHALL also
recognize LaTeX math and highlight it distinctly from surrounding prose rather than
showing it as uniform plain text. Inline math (delimited by single dollar signs)
and block math (delimited by double dollar signs) SHALL both be highlighted, and
the highlighting SHALL distinguish the math delimiters and, within block math,
LaTeX commands such as a fraction command from plain text. The highlighting SHALL
avoid obvious false positives on non-math dollar-sign usage such as prose prices.

#### Scenario: Inline and block math are highlighted

- **WHEN** a note contains inline math `$a^2+b^2$` and a block `$$ \int_0^1 x\,dx $$`
- **THEN** the editor SHALL highlight those math spans/regions distinctly from the
  surrounding prose, distinguishing the delimiters and (in block math) LaTeX
  commands

#### Scenario: Non-math dollar signs are not treated as math

- **WHEN** a note contains prose like "it costs $5 and $10"
- **THEN** that text SHALL NOT be highlighted as math

### Requirement: Editor follows the app theme

The note editor SHALL follow the application's light/dark theme: it SHALL use a
light editor theme when the app is light and a dark editor theme when the app is
dark, and SHALL update live when the theme changes. The editor background SHALL
blend into the surrounding note panel rather than introduce a contrasting block.

#### Scenario: Editor matches the active theme

- **WHEN** the app is in dark mode and a note editor is shown
- **THEN** the editor SHALL use a dark syntax-highlighting theme

#### Scenario: Theme change reskins the editor live

- **WHEN** the user toggles the app theme while a note editor is open
- **THEN** the editor's theme SHALL update without reopening the editor

### Requirement: Prose-oriented editing chrome with line numbers

The note editor SHALL be configured for prose Markdown rather than as a full IDE:
long lines SHALL soft-wrap (no horizontal scrolling required to read a paragraph),
and the editor SHALL NOT show a minimap and SHALL NOT pop up
code-completion/IntelliSense suggestions while typing prose. The editor SHALL show
line numbers in its gutter.

#### Scenario: Long lines wrap

- **WHEN** a paragraph is longer than the editor width
- **THEN** it SHALL soft-wrap to the next line rather than require horizontal
  scrolling

#### Scenario: Line numbers are shown

- **WHEN** the note editor is shown
- **THEN** it SHALL display line numbers in its gutter

#### Scenario: No IDE chrome

- **WHEN** the note editor is shown
- **THEN** it SHALL display no minimap and SHALL NOT raise a code-completion popup
  while the user types prose

### Requirement: Editor preserves existing note-editing behaviors

Replacing the textarea with Monaco SHALL NOT regress any existing note-editing
behavior. The Monaco editor SHALL continue to satisfy the autosave, commit, IME,
paste, heading-demotion, and conflict behaviors defined by the
`note-editor-window` and `notes-walkthrough` capabilities. Specifically:
write-through autosave with a debounce; immediate commit on blur, on Enter, and
on window close; no write-through during IME composition; `Ctrl/Cmd+S` to commit;
pasted images upload and insert a Markdown image link at the cursor; section-window
heading demotion on write-through; and structure/cross-tab conflict detection.

#### Scenario: Autosave and commit still work

- **WHEN** a user edits in the Monaco editor and then blurs it, presses Enter, or
  closes the window before the debounce elapses
- **THEN** the edit SHALL be committed to the shared document and persisted, just
  as with the previous textarea

#### Scenario: IME composition is still guarded

- **WHEN** a user composes text with an IME (e.g. Chinese pinyin) in the Monaco
  editor
- **THEN** write-through SHALL NOT fire mid-composition and the text SHALL NOT
  revert

#### Scenario: Paste-to-upload still inserts at the cursor

- **WHEN** a user pastes an image into the Monaco editor
- **THEN** the image SHALL upload and a Markdown image link SHALL be inserted at
  the cursor position

#### Scenario: Section-window heading demotion still applies

- **WHEN** a user types a Markdown heading line in a section floating window using
  the Monaco editor
- **THEN** on write-through it SHALL be normalized to bold rather than persisted
  as a heading, and the normalization SHALL be made visible to the user (e.g. in
  the preview pane), as before

### Requirement: Editor loads on demand without blocking initial load

The Monaco editor SHALL be loaded on demand (only when a note editing surface is
mounted) so that pages which do not mount a note editor SHALL NOT download the
editor. While the editor is loading, the editing surface SHALL show a lightweight
placeholder sized to its container so the layout does not jump, and SHALL replace
it with the editor once ready.

#### Scenario: Pages without note editing do not load Monaco

- **WHEN** the user views a page that does not mount any note editing surface
- **THEN** the Monaco editor code SHALL NOT be downloaded for that page

#### Scenario: Placeholder while the editor loads

- **WHEN** a note editing surface first mounts and the editor is still loading
- **THEN** a placeholder sized to the editor area SHALL be shown and then replaced
  by the editor without a layout jump
