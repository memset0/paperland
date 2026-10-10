## 1. Shared state

- [x] 1.1 Add `composables/useQAConversation.ts` (open/width/available, per user+paper tabs + active, persistence, openThread/newTab/closeTab/setActiveTail)
- [x] 1.2 Single-model selection: `QAInput` model buttons single-choice; `stores/qa.ts` trims cached selection to one model

## 2. Conversation view

- [x] 2.1 `QAThreadView.vue`: resolve thread from tree API + live store, render question/answer messages with inputs, placeholders, live streaming
- [x] 2.2 `QAConversationPanel.vue`: tabs bar (switch/close/new), thread area auto-scrolling, docked `QAInput`
- [x] 2.3 `QAInput.vue` docked mode: no fixed/move/resize/close; follow-up driven by active tab; disabled while tail not done; after submit move tab tail to the new answer
- [x] 2.4 `PaperDetail.vue`: third resizable column, launcher toggle, single QAInput instance, openRequests/followup routing while the view is open

## 3. Entry points

- [x] 3.1 "Open in conversation" action on answers (`QAResultBody` → `QAResultView` → `QAList`), follow-up/`#moonlight` route to the thread when the view is open

## 4. Tree view

- [x] 4.1 `QATreeView.vue` mind map grouped by parent question; node click opens thread / reveals entry
- [x] 4.2 Open the tree in a floating window (QAList unchanged)
- [x] 4.3 Shared floating-window mechanism: generalize `stores/windows.ts`, `FloatingWindow.vue` shell + `FloatingWindowHost.vue`; note windows, Q&A tree and the question box all use it

## 5. Page layouts

- [x] 5.1 Layout state (`split` / `split-conv` / `three`) + fractional proportions with persistence and clamping in `useQAConversation`
- [x] 5.2 Header layout selector; `PaperDetail` renders the three layouts with draggable dividers (split-conv shares the split ratio); reusable info & Q&A template
- [x] 5.3 `PaperViewerPanel` optional "Metadata" and "Q&A" tabs after "Note" (Q&A = Preset + User Q&A lists, Metadata = everything else); `revealQAEntry` activates the Q&A tab
- [x] 5.4 Docs, type-check, build, e2e (switch layouts, drag, reload keeps proportions, reveal from thread activates tab)

## 6. Docs and verification

- [x] 6.1 Update `docs/frontend-architecture.md` (and check `tech-stack.md` / `external-api.md`)
- [x] 6.2 Type-check, verification build, browser e2e on the scratch backend (open thread, tabs, follow-up in place, streaming, draft persistence, tree)
