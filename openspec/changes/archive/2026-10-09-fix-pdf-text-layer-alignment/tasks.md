## 1. Text-layer alignment

- [x] 1.1 In `PdfViewer.vue`, define `--total-scale-factor` (bound reactively to the current effective scale) and `--scale-round-x` / `--scale-round-y` on each page element, and stop relying on the legacy `--scale-factor` / hard-coded text-layer size. Verify by checking in the browser that the text-layer spans get a valid computed `font-size` and the layer size matches the canvas.
- [x] 1.2 Verify alignment in the running app: select text at fit-width and after zooming in and out (including a selection during a split-pane drag), and confirm the highlight covers the glyphs. Also confirm that copying a selection anchor link and navigating to it still highlights the right text.

## 2. Docs

- [x] 2.1 Update `docs/frontend-architecture.md` (PDF viewer section) to note that the text-layer scale variables come from the page element. Confirm `docs/external-api.md` and `docs/tech-stack.md` need no change.
