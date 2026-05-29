## ADDED Requirements

### Requirement: Copy an anchor link from a selection
The selection floating toolbar (the same one offering highlight colors) SHALL include a "复制为锚点链接" (copy anchor link) action for authenticated users. Choosing it SHALL build a `paperland://` anchor link from the current selection — using the paper id and the selected block's `content_hash`, plus the selection's `start`/`end` offsets when a sub-range is desired — and place the resulting Markdown link on the clipboard so it can be pasted into any note body. (See the `markdown-anchors` capability for the link scheme.)

#### Scenario: Copy an anchor link from a Q&A answer selection
- **WHEN** an authenticated user selects text within a Q&A answer and chooses "复制为锚点链接"
- **THEN** the clipboard SHALL contain a Markdown link whose href is `paperland://paper/<id>?h=<content_hash>` (with `&s=&e=` reflecting the selection) addressing that block

#### Scenario: Pasted anchor link is clickable in a note
- **WHEN** the copied anchor link is pasted into a note body and the note is previewed
- **THEN** the link SHALL be clickable and SHALL locate the addressed block per the `markdown-anchors` capability

#### Scenario: Action hidden for anonymous users
- **WHEN** an anonymous visitor selects text
- **THEN** the toolbar SHALL NOT offer "复制为锚点链接" (it requires login, consistent with other selection actions)
