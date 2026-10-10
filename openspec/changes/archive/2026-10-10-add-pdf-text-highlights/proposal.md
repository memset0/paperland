## Why

Users read papers mainly in the embedded PDF viewer, but they can only mark passages in the Markdown and QA views. They want to color-highlight passages directly in the PDF, using the same per-user model and colors as the existing Markdown/QA highlights. They also want to switch between seeing only their own highlights and everyone's shared highlights. Clicking a highlight should make the passage available for translation, one-click ask, or adding to the question box.

## What Changes

- Persistent, per-user, colored text highlights in the PDF viewer, using the existing four highlight colors (yellow, green, blue, pink).
- When a logged-in user selects text on a single page, the selection toolbar offers color swatches to create a highlight.
- Highlights are drawn as an overlay aligned with the PDF text and stay aligned through zoom, re-render, and theme changes. The user's own highlights are filled; other users' shared highlights are shown as a dashed underline with the owner's name on hover.
- Clicking a highlight selects its passage and opens the normal selection toolbar (translate, ask, add to question box, copy link). For the user's own highlight, the toolbar can also change its color or delete it.
- A mine/all scope toggle in the PDF toolbar. It is the same shared setting as the Markdown/QA highlight toggle.
- Highlights are stored in the existing `highlights` storage, keyed to the paper and to the exact PDF file and page. If a paper's PDF is replaced, highlights made on the old file are not drawn on the new one.

## Capabilities

### New Capabilities
- `pdf-highlights`: persistent per-user colored highlights on PDF text, their visibility scope, and the click-to-act interaction.

### Modified Capabilities

## Impact

- Frontend: `packages/frontend/src/components/PdfViewer.vue` (overlay rendering, toolbar actions, scope toggle). It reuses `stores/highlights.ts`, `HighlightScopeToggle.vue`, and `useHighlight` offset helpers.
- Backend/DB: no schema or API change. PDF highlights go through the existing `/api/highlights` endpoints and sharing rules.
- Docs: `docs/frontend-architecture.md`. `docs/external-api.md` and `docs/tech-stack.md` are unaffected.
