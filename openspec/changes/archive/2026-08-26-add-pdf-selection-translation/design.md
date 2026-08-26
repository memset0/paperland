## Context

See `proposal.md` for motivation. `PdfViewer.vue` already renders selectable pdf.js text layers and listens to document-level `selectionchange`. After a 60ms debounce, `handleSelectionSettled()` verifies that one Range belongs to one `.pdf-page .textLayer`, calls `getSelectionOffsets(textLayer)`, stores `{page,ts,te,text}`, and positions the existing copy-selection-link button from the Range/client and viewer rectangles. The viewer also owns zoom/rerender, scroll, capture mode, cleanup, and selection listeners.

The recently archived translation change provides authenticated `POST /api/translate/stream`, global content-hash caching, abort propagation, and the style-transparent `StreamingTranslationText` component. This feature should compose those pieces rather than add another model/API/cache path.

## Goals / Non-Goals

**Goals:**

- Infer translation intent only from a valid single-page selection that remains identical for 500ms.
- Attach a streaming result panel to the live native selection without breaking text selection or the existing link action.
- Cancel aggressively when selection identity or viewer lifecycle changes, so no stale result appears over another range.
- Reuse auth, cache, SSE parsing, progressive delta painting, and errors from `StreamingTranslationText`.
- Keep positioning usable in narrow split panes and during normal PDF scrolling.

**Non-Goals:**

- No OCR for image-only PDFs and no translation of canvas pixels.
- No cross-page selection translation; existing selection-link constraints remain single-page.
- No persistence of panel position/history and no new translation table/API.
- No automatic translation for anonymous readers and no automatic login modal from `selectionchange`.
- No replacement of the browser's selection/copy UI, PDF anchors, persistent highlights, or region screenshot capture.
- No language picker in this change; translation remains configured English → Simplified Chinese.

## Decisions

### 1. Keep the 60ms selection capture and add a separate 500ms intent timer

The existing 60ms debounce is useful for quickly updating `selRegion` and the copy-link button. Do not slow that UI to 500ms. After each valid capture, compute an immutable identity such as `page:ts:te:<text>` and pass it to a dedicated translation-intent controller:

```text
selectionchange
  → 60ms capture debounce
  → validate one page/textLayer + compute offsets/text/range rect
  → immediately refresh copy-link state
  → replace 500ms translation candidate timer
  → if identity still current at expiry: mount translation request once
```

Invalid/collapsed selections normally clear both controllers immediately. The exception is a collapse caused while the visible translation panel owns the pointer interaction: that transient focus transfer preserves the active panel/source snapshot until an outside interaction or a replacement selection settles. The 500ms value is a feature constant named for behavior and covered by fake-timer tests.

**Alternative considered:** replace the existing debounce with 500ms. Rejected because it would make the current copy-selection-link affordance feel delayed and couple two distinct intentions.

### 2. Use page/offset/text identity, not text alone

The selection identity contains page, `ts`, `te`, and normalized selected text. Text alone is insufficient because repeated phrases on the same or different pages could incorrectly reuse the live panel/request identity. The backend cache still keys by text as designed, so a different range with identical text gets an immediate cache hit but a fresh correctly positioned panel.

Store a cloned DOM Range or the latest stable client rects only for positioning; never use DOM node identity as the logical request identity because pdf.js replaces nodes during rerender.

### 3. Gate before mounting StreamingTranslationText

Read `auth.isAuthenticated` during candidate handling. Anonymous selections do not arm the 500ms timer and do not call `openLogin()`. For authenticated users, expiry sets an `activeTranslationSelection` snapshot and increments a component key; mounting `StreamingTranslationText` performs the cache-first request. Retry increments the key with `force:true` only if the selection identity is still current.

The child already owns AbortController/generation protection. Unmounting it aborts the request; parent identity checks additionally prevent a late child event from changing panel status.

**Alternative considered:** call `translationApi.stream` directly inside PdfViewer. Rejected because that would duplicate streaming state, SSE error handling, progressive painting, and cancellation already encapsulated in the child.

### 4. Treat selection UI as one anchored overlay cluster

Introduce a selection snapshot containing the logical region plus a viewer-relative anchor rectangle. Keep the existing copy-link button, but calculate both button and panel positions from the same snapshot to prevent drift.

The panel uses absolute positioning under `.pdf-viewer-root` (the same coordinate space as the existing button), with `z-index` above text/canvas. Default max width is approximately 360px, capped to `viewerWidth - 16px`; result content wraps and has a bounded max height with internal scrolling.

Placement algorithm:

1. Center horizontally on the selection and clamp to half panel width + 8px inset.
2. Prefer above: anchor panel bottom to `selection.top - 8px`.
3. If measured/estimated panel height does not fit above, place below the selection.
4. When below, reserve space for or stack after the existing copy-link action so controls do not overlap.
5. After mount/content growth, a ResizeObserver or next-frame measurement recomputes placement and clamps vertically.

Use `@pointerdown` ownership plus `@mousedown.prevent` on panel controls so clicking close/retry/copy does not tear down the panel when the browser transiently collapses the PDF Range. The panel retains a cloned source Range and restores it after internal pointer interaction when possible. A dedicated Copy translation action can copy the completed/partial visible text without requiring users to select inside the panel.

An outside pointer interaction is settled after pointer-up, not at pointer-down. A plain outside click dismisses the existing panel. If that gesture creates a different valid PDF selection, keep the old panel during the new 500ms candidate interval and replace/abort it only when the new identity activates; this avoids a blank 500ms gap while still honoring explicit outside dismissal.

### 5. Reposition on scroll; cancel on structural changes

The existing `onScroll` path schedules a single animation-frame reposition when a panel is open. It resolves the current browser Range again, confirms it still belongs to the same text layer/identity, and updates the anchor. If it is invalid or outside the viewer, close/abort.

Zoom, fit recalculation that rerenders text layers, PDF path changes, `cleanupDoc()`, capture-mode entry, and component unmount cancel timer/request/panel before replacing DOM. Escape closes active selection translation first, while retaining the normal selected text unless browser behavior collapses it separately.

### 6. Keep a compact, plain-text panel state machine

Panel states:

- `waiting`: mounted/connecting, heading plus spinner.
- `streaming`: growing plain-text translation, spinner remains subtle.
- `completed`: authoritative translation and optional Copy/close/retry controls.
- `failed`: concise error with Retry and close; partial output may remain visibly provisional.

The child is rendered with a scoped slot so PdfViewer controls panel markup while `StreamingTranslationText` owns the request. The panel never renders Markdown because selected PDF text and its translation are plain text.

## Risks / Trade-offs

- [Selectionchange fires repeatedly while dragging] → Keep immediate 60ms capture but replace the 500ms intent timer on every identity change; only the last stable identity starts, and an existing panel remains visible until that replacement activates.
- [Clicking the panel collapses the browser selection before pointer-up] → Mark the panel as the interaction owner before the collapse event, preserve the active snapshot/panel, and restore the cloned Range on pointer-up; only a later outside gesture or stable replacement dismisses it.
- [Provider/cache completes after selection changes] → Unmount aborts child and parent checks immutable identity/generation before accepting events.
- [Range rect becomes stale during scroll/zoom] → Recompute on scroll rAF; cancel before text-layer rerender and on invalid DOM Range.
- [Panel covers source or leaves narrow pane] → Measure, prefer above, fall below, clamp width/x/y, and give content a bounded scroll area.
- [Existing copy button overlaps fallback panel] → Position both from one overlay snapshot and reserve explicit vertical spacing in below mode.
- [Auto translation surprises anonymous/public readers] → Authenticate before arming; do not auto-open login.
- [Very short selections create noisy calls] → The exact non-empty behavior requested remains; cache and 500ms stability limit churn. A future minimum-length setting can be added if usage shows noise.
- [Selection text contains line breaks/hyphenation] → Send the text returned by existing `getSelectionOffsets`; prompt/cache behavior remains centralized and inspectable.

## Migration Plan

1. Extract/test pure helpers for selection identity, 500ms candidate lifecycle, and anchored panel placement without changing PdfViewer UI.
2. Extend PdfViewer selection snapshot and cleanup/scroll/capture hooks while preserving existing copy-link behavior.
3. Add authenticated stable-selection activation and mount `StreamingTranslationText` in a selection panel with status/retry/close/copy.
4. Add collision/clamp/ResizeObserver positioning and pointer behavior.
5. Update `docs/frontend-architecture.md`, `docs/external-api.md`, and `docs/tech-stack.md`.
6. Run pure timer/placement tests, frontend production build, and a headless text-layer interaction with mocked translation SSE; do not call a real provider.
7. Regression-harden focus transfer: preserve the panel across panel-owned selection collapse, dismiss a plain outside click, and defer replacement until a different selection is stable.

No DB or backend migration is required. Rollback removes the translation intent/controller/panel while leaving the existing selection-link button and translation service untouched.
