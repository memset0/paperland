## Why

Text selection in the embedded PDF viewer drifts away from the rendered glyphs (worse toward line ends, and the highlight often jumps between lines). pdf.js 5.x sizes its text-layer spans with the CSS variable `--total-scale-factor`, which our custom viewer never defines (it only sets the legacy `--scale-factor`), so every span's `font-size` is invalid and falls back to an inherited size. The bug has existed since the pdf.js viewer was first embedded.

## What Changes

- Define `--total-scale-factor` (plus `--scale-round-x` / `--scale-round-y`) on each PDF page so the pdf.js text layer gets the font sizes and layer dimensions it expects, and selection lines up with the canvas.
- Bind the variable to the current effective zoom. During zoom or split-pane resizing, the text layer then scales together with the CSS-scaled canvas, and selection stays aligned before the debounced re-raster lands.

## Capabilities

### New Capabilities

### Modified Capabilities
- `pdfjs-viewer`: the selectable text layer must stay visually aligned with the rendered page at any zoom, including while a zoom change is pending re-raster.

## Impact

- `packages/frontend/src/components/PdfViewer.vue` (page styling / text-layer setup).
- `docs/frontend-architecture.md` (PDF viewer notes).
- No API, config, or dependency changes. Anchor text offsets (`ts`/`te`) are unaffected because text content extraction does not change.
