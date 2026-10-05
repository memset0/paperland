## Why

The note system has two non-obvious "power" features and no in-app guidance for them: the **headings + blockquote** Markdown syntax that drives the mind-map, and capturing a **full image link from the PDF**. A small "?" help control in the left Note panel's function bar surfaces a short help dialog, so users can discover both without reading external docs.

## What Changes

- Add a **"?" help icon** to the left "Note" panel's function bar (the mode bar with edit / split / render).
- Clicking it opens a **help dialog** about the note system, covering at least:
  - **Mind-map via headings + blockquotes**: Markdown headings become mind-map nodes by relative depth (a deeper heading nests one level); the text under a heading is that node's content; a **leading blockquote** (`>`) at the start of a node's content becomes a read-only **content node** (plain text / image / formula), and several consecutive leading blockquotes become several content nodes.
  - **Full image link from a PDF**: in the PDF viewer toolbar, the **Crop** (screenshot) tool enters region-capture mode; drag a rectangle over the region and release — it is rendered to an image, uploaded to the image host, and a Markdown image link wrapped in a `paperland://…?pdf=…` anchor is copied to the clipboard to paste into the note.

## Capabilities

### Modified Capabilities
- `notes-walkthrough`: the left panel's function bar gains a "?" help control that opens a help dialog describing the mind-map heading/blockquote syntax and the PDF region image-capture.

## Impact

- **Frontend only.** `components/notes/NoteWalkthrough.vue` (a "?" button in the mode bar) and a new help dialog component (e.g. `NoteHelpDialog.vue`) reusing `components/ui/dialog`. No store/API change.
- **Docs**: `docs/frontend-architecture.md` (notes section).
