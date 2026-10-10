## 1. Capture highlight and menu placement

- [x] 1.1 In `PdfViewer.vue`, render the pending capture region as a persistent highlight inside its `.pdf-page` (positioned in normalized page space), with the action menu centered below it. Mousedowns on the menu must not start a new drag. Verify with `vue-tsc` and in the browser: after release, the highlight and menu stay aligned while scrolling and zooming.
- [x] 1.2 Keep the highlight and menu during an in-flight upload (actions disabled) and after a failed upload. Clear them on success, `Esc`, a new drag, or exiting capture mode. Make sure the ask panel is still positioned next to the region. Verify each path in the browser.

## 2. Docs

- [x] 2.1 Update the 框选截图 bullet in `docs/frontend-architecture.md` to describe the persistent highlight and the menu placement. Confirm `docs/external-api.md` and `docs/tech-stack.md` need no change.
