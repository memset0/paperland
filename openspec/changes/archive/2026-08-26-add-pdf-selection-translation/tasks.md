## 1. Selection intent and placement primitives

- [x] 1.1 Extract a typed PDF selection snapshot/identity helper (`page`, `ts`, `te`, text, viewer-relative rect) from the current PdfViewer capture path; verify fixtures distinguish repeated text at different offsets/pages and reject collapsed/cross-page/outside-text-layer selections
- [x] 1.2 Implement a replaceable 500ms stable-selection intent controller with explicit cancel/activate/deduplicate behavior; verify fake-timer tests cover unchanged expiry, changes at 499ms, collapsed selection, repeated identical `selectionchange`, and retry generation
- [x] 1.3 Implement a pure panel placement helper (preferred above, below fallback, viewer insets, narrow-width clamp, reserved copy-link spacing); verify table-driven geometry tests cover top/left/right edges and content resize

## 2. PdfViewer selection lifecycle integration

- [x] 2.1 Extend the existing 60ms `handleSelectionSettled` snapshot without delaying/removing `selRegion`, offsets, native selection, or copy-selection-link positioning; verify current selection-link behavior still passes a focused component/source regression check
- [x] 2.2 For authenticated users only, feed valid snapshot identities into the independent 500ms controller and mount exactly one translation selection after expiry; verify anonymous selections do not arm timers, call translation, or invoke the login prompt
- [x] 2.3 Cancel pending/active translation state when the selection changes/collapses/becomes invalid, the PDF path changes, capture mode starts, text layers rerender, cleanup runs, or the viewer unmounts; verify controlled stale-event tests cannot update a newer selection
- [x] 2.4 Recompute the live selection anchor on the existing scroll animation-frame path while identity remains valid, and close when its Range is stale/outside the viewer; verify scroll fixtures update coordinates once per frame rather than per event

## 3. Streaming translation panel UI

- [x] 3.1 Add a selection-anchored Translation panel in `PdfViewer.vue` that mounts `StreamingTranslationText` with the stable selected text and exposes waiting/streaming/completed/failed states; verify cache-hit done and mocked multi-delta streams render the correct plain text/status
- [x] 3.2 Apply the placement helper, measured panel size, bounded max width/height, above/below mode and responsive clamp in the same root coordinate space as the copy-selection-link button; verify no overlap in below fallback and no overflow in a narrow split pane
- [x] 3.3 Add close, retry (`force:true` for unchanged identity), and copy-visible-translation actions; use pointer/mousedown prevention so panel controls preserve the source Range, and verify Escape closes/aborts without deleting the completed translation cache
- [x] 3.4 Add scoped styles and coarse-pointer sizing for the panel without changing pdf.js text-layer selection CSS or screenshot capture cursor behavior; verify frontend build contains no template/style warnings from the new overlay

## 4. Integration tests and documentation

- [x] 4.1 Add a headless/mock-SSE PdfViewer interaction covering: selection changed before 500ms (no request), stable `hello, world` (one request), visible first delta before done, cache hit, new selection abort/stale isolation, anonymous no-call, scroll reposition, and capture-mode cancellation
- [x] 4.2 Update `docs/frontend-architecture.md` with the dual 60ms/500ms selection flow, overlay positioning and lifecycle; verify it documents authentication, streaming reuse, and coexistence with the selection-link button
- [x] 4.3 Update `docs/tech-stack.md` to record that PDF selection translation reuses the existing Internal SSE API/cache and adds no DB/provider path; verify no new backend dependency or table is documented
- [x] 4.4 Update `docs/external-api.md` to state PDF selection translation is authenticated Internal UI/API only and does not change Bearer External API; verify the external endpoint inventory is unchanged

## 5. Focused verification

- [x] 5.1 Run only the new selection-intent/placement/headless fixtures plus existing frontend streaming helpers; verify all pass without a real model or external service call
- [x] 5.2 Run the frontend production build from `packages/frontend` and wait for the real Vite child to exit; verify the emitted PdfViewer chunk contains the selection translation panel
- [x] 5.3 With the root dev app running, manually verify a stable PDF selection shows the panel after ~500ms, streams above/below correctly, copy link still works, changing selection cancels it, and anonymous access makes no translation request
- [x] 5.4 Run strict OpenSpec validation and a final diff audit; verify all tasks are complete, only this change's paths would be staged, and `packages/backend/data/` is absent

## 6. Panel focus-transfer regression fix

- [x] 6.1 Reconcile proposal/design/delta + already-synced main spec and all three required docs with panel-owned collapse, outside dismissal, and delayed stable replacement semantics
- [x] 6.2 Preserve the active panel/source snapshot when an internal pointer interaction collapses native selection; settle outside pointer gestures after pointer-up and keep the old panel until a different selection activates after 500ms
- [x] 6.3 Add focused transition coverage and rerun frontend streaming/helper tests, production build, headless panel interaction, strict change/spec validation, and diff checks without a real model call
