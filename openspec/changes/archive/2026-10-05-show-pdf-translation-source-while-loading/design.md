## Context

See `proposal.md` for motivation and `specs/pdfjs-viewer/spec.md` for observable behavior. `PdfViewer.vue` already passes the stable selection text into `StreamingTranslationText` and consumes its scoped slot `{ text, status }`. The slot currently renders translated `text` when non-empty, otherwise a spinner plus “等待翻译…” while connecting. The parent therefore already has all data needed for this adjustment; no translation-service or streaming-component contract change is required.

## Goals / Non-Goals

**Goals:**

- Make the selected source text immediately visible in the panel result area until translated text exists.
- Switch atomically from source preview to real translated text on the first non-empty slot value, including cache hits.
- Preserve the existing loading/status semantics for accessibility and control enablement without showing loading copy in the result body.

**Non-Goals:**

- Do not alter `StreamingTranslationText`, SSE timing, delta buffering, provider calls, cache behavior, or retries.
- Do not add a persistent bilingual/source section after translation begins.
- Do not change the standalone translation test page or other translation consumers.

## Decisions

### 1. Implement the fallback in PdfViewer's scoped slot

Render the slot's translated `text` whenever it is non-empty; otherwise render `activeTranslation.text` with a dedicated source-preview class. This keeps the behavior local to PDF selection translation and uses the immutable source snapshot that owns the request.

Passing fallback content into the shared component was considered, but rejected because other consumers have different waiting-state UX and do not request this source-preview behavior.

### 2. Keep state indication outside the body copy

The existing header state and the shared component's `aria-busy` semantics remain authoritative while connecting/streaming. The body will not include a spinner paired with textual loading copy. This avoids presenting the selected source as though it were already translated while retaining machine-readable and visible state context.

### 3. Preserve source formatting as plain text

Use the same plain-text rendering and `white-space: pre-wrap` behavior as translation output. The source preview must not be interpreted as Markdown or HTML.

## Risks / Trade-offs

- [Users may momentarily mistake the source preview for a translation] → Keep the existing Translation heading/state visible and replace the preview as soon as real output arrives.
- [An empty translated delta could hide the source too early] → Key the switch on the accumulated non-empty translated `text`, not merely on status changing to streaming.
- [Long source selections enlarge the panel before output] → Reuse the existing bounded, scrollable panel body and ResizeObserver positioning behavior.

## Migration Plan

Update the PdfViewer slot fallback and scoped style, add a focused mocked-state assertion, synchronize the three required architecture documents, and run only frontend-local verification. Rollback restores the previous waiting placeholder; no data or API migration is involved.
