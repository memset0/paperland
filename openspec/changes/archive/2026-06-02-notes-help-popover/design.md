## Context

The left "Note" panel (`NoteWalkthrough.vue`) has a function bar with the mode switch (edit / split / render) and the pop-out control. The mind-map (`note-mindmap`) is built from headings + leading blockquotes; the PDF region screenshot feature (`PdfViewer.vue`) copies a `[![](url)](paperland://…?pdf=…&rx…)` link to the clipboard. Neither is discoverable in-app. This change adds a help affordance there.

## Goals / Non-Goals

**Goals:**
- A "?" control in the left Note function bar that opens a concise help dialog.
- Cover the two features the user asked for: heading/blockquote mind-map syntax, and capturing a PDF region as an image link.

**Non-Goals:**
- A full docs site or contextual tours. One static dialog.
- Changing how the mind-map or PDF capture actually work.

## Decisions

### D1 — Help button in the mode bar
Add a `?` icon (lucide `CircleHelp` / `HelpCircle`) button to `NoteWalkthrough.vue`'s function bar, next to the pop-out / mode controls. It toggles a help dialog (local `ref`).

### D2 — Reuse the existing Dialog UI
Render the help via the project's `components/ui/dialog` (`Dialog` + `DialogContent` + `DialogHeader`/`DialogTitle`, with scrollable body). Put the content in a small `NoteHelpDialog.vue` so `NoteWalkthrough.vue` stays lean.

### D3 — Static content, two sections
The dialog is static help content with two sections:
1. **Mind-map syntax** — headings → nodes (relative depth nesting); a heading's body is the node content; a leading `>` blockquote → a read-only content node (text / image / formula); consecutive leading blockquotes → multiple content nodes. Include tiny Markdown examples.
2. **PDF → image link** — use the PDF viewer's Crop tool, drag a region, release; the cropped image is uploaded and a paste-ready Markdown image link (with a `paperland://…?pdf=…` anchor) lands on your clipboard.
Wording matches the Notes UI (English labels); examples shown as code.

## Risks / Trade-offs

- **[Help drifts from behavior]** → Keep it short and high-level (concepts + one example each), not exhaustive, so it ages well.
