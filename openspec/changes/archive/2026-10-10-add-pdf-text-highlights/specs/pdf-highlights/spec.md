## Purpose

Persistent, per-user colored highlights on the text of a paper's PDF in the embedded viewer: creating, viewing (own or everyone's shared), recoloring and deleting them, and clicking one to reuse the passage for translation, asking, or the question box.

## ADDED Requirements

### Requirement: Create a PDF highlight from a selection
When an authenticated user selects text within a single page of a paper's PDF, the selection toolbar SHALL offer the highlight colors yellow, green, blue, and pink. Choosing a color SHALL persist a highlight owned by that user for that paper, recording the page, the selection's character offsets within that page's text, the selected text, and the color. It SHALL be tied to the specific PDF file being viewed. The highlight SHALL appear immediately. Highlight colors SHALL NOT be offered to anonymous visitors, for multi-page selections, or when the viewer has no paper id.

#### Scenario: Highlight a passage
- **WHEN** a logged-in user selects a sentence on page 3 and chooses green
- **THEN** a green highlight covering that sentence SHALL appear on page 3 and SHALL still be shown after reloading the paper

#### Scenario: No highlight colors for anonymous or multi-page selections
- **WHEN** an anonymous visitor selects text, or a logged-in user selects text spanning two pages
- **THEN** the toolbar SHALL NOT offer highlight colors

### Requirement: Highlights stay aligned with the text
PDF highlights SHALL be drawn over exactly the highlighted glyphs of their page and SHALL stay aligned when the user zooms, resizes the split pane, switches theme, or scrolls, including after pages are re-rendered. A highlight recorded on a different PDF file than the one currently shown for the paper SHALL NOT be drawn.

#### Scenario: Zoom keeps highlights aligned
- **WHEN** the user zooms in after highlighting a passage
- **THEN** the highlight SHALL cover the same glyphs at the new zoom level

#### Scenario: Replaced PDF hides stale highlights
- **WHEN** a paper's PDF file is replaced by a different file
- **THEN** highlights made on the previous file SHALL NOT be drawn on the new one

### Requirement: Mine and all visibility
The PDF viewer SHALL offer a mine/all highlight scope toggle to authenticated users. This SHALL be the same setting used by Markdown and QA highlights. In "mine" the viewer SHALL show only the user's own PDF highlights. In "all" it SHALL also show other users' highlights that the sharing rules make visible to this user. The user's own highlights SHALL be drawn as filled color. Other users' highlights SHALL be drawn as a dashed underline in their color, with the owner's display name available on hover over the passage. Anonymous visitors SHALL see no highlights.

#### Scenario: Switch to all
- **WHEN** a user who sees only their own highlights switches the scope to all
- **THEN** other users' visible highlights SHALL appear as dashed underlines in addition to the user's filled highlights

#### Scenario: Shared toggle
- **WHEN** the user changes the scope in the PDF viewer
- **THEN** Markdown and QA highlights on the same paper SHALL follow the same scope

### Requirement: Click a highlight to act on its passage
Clicking a highlight (a click without dragging, outside region-capture mode) SHALL select that highlight's passage and show the regular selection toolbar for it. The toolbar SHALL include translation, one-click ask, add to question box, and copy link, subject to the same availability rules as for a manual selection. When several highlights overlap at the click point, the most recently created one SHALL be selected. When the selected passage is one of the user's own highlights, the toolbar SHALL mark its current color, SHALL recolor it when another color is chosen, and SHALL offer deleting it.

#### Scenario: Ask about a highlighted passage
- **WHEN** a logged-in user clicks one of the highlights and chooses one-click ask
- **THEN** the viewer SHALL start a direct ask with that highlight's text, exactly as if the user had selected the passage manually

#### Scenario: Recolor and delete own highlight
- **WHEN** the user clicks their own yellow highlight, chooses pink, then later clicks it again and chooses delete
- **THEN** the highlight SHALL turn pink and then be removed, and both changes SHALL persist

#### Scenario: Other users' highlights are read-only
- **WHEN** the user clicks another user's highlight
- **THEN** the toolbar SHALL offer the regular actions but SHALL NOT offer recoloring or deleting that highlight
