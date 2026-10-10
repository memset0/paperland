## Why

After dragging a region in the PDF viewer's region-capture mode, the rubber-band rectangle disappears the moment the mouse is released. The action menu then appears at the drag's bottom-right corner, in viewer coordinates. Once the page scrolls, the menu no longer lines up with anything, so it is easy to lose track of which region was selected before choosing an action.

## What Changes

- Keep the captured region visibly highlighted (outlined and tinted) from release until the capture is resolved: an action completes, the menu is dismissed, a new drag starts, or capture mode exits.
- Place the capture action menu centered directly below the highlighted region, and anchor both to the page so they scroll and zoom with the PDF.
- Keep the highlight and menu visible while an upload is in progress (buttons disabled), and keep them after an upload failure so the user can retry.

## Capabilities

### New Capabilities

### Modified Capabilities
- `pdfjs-viewer`: the region-capture requirement now specifies a persistent highlight of the captured region and places the action menu below it, anchored to the page.

## Impact

- `packages/frontend/src/components/PdfViewer.vue` (capture state, template, styles).
- `docs/frontend-architecture.md` (框选截图 notes).
- No API, config, or data changes.
