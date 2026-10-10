## Why

When a paper accumulates many Q&As and follow-ups, the flat Q&A list hides how questions build on each other, and reading a follow-up chain means jumping between collapsed entries. Users need (1) a chat-style view that shows one follow-up chain as a conversation and lets them keep asking in place, and (2) a mind map of the whole follow-up hierarchy.

## What Changes

- **Conversation view (对话视图)**: on the wide paper-detail split layout, a third column to the right of the Q&A column, resizable by dragging its divider.
  - A *thread* is derived, not stored: pick an answer (any status, including queued/streaming) and the thread is that answer plus every ancestor question and the specific ancestor answer it continued, rendered as alternating question / answer messages. Streaming answers update live.
  - Several threads can be open at once as tabs along the top of the column; tabs and the active tab survive reloads (per user + paper). A "new conversation" tab has no thread and asks a fresh root question.
  - A layout selector at the top right of the paper header picks one of three layouts: split (viewer | info & Q&A, as before), paper + conversation (viewer | conversation, with the info & Q&A column split into "Metadata" and "Q&A" viewer tabs after "Note"; same left/right ratio as split), and three columns (viewer | info & Q&A | conversation). Proportions are stored as page-width fractions and restored correctly after a reload (fixes the three-column ratio going wrong on refresh).
  - Every answer in the Q&A list gets an "open in conversation" action (switching to the last conversation layout when in split).
  - While the view is open the floating question box is not shown: the one global question box is docked at the bottom of the column and keeps its draft (text, attachments) across tab switches and opening/closing the view. Adding PDF passages/screenshots and 追问 / `#moonlight` actions all feed this same box.
  - In the view, the box always continues the active thread's last answer (a follow-up), or asks a root question in a new-conversation tab; asking is disabled until that answer is done. After submitting, the active tab moves to the new answer so the user lands in the thread automatically.
- **Q&A tree (树视图)**: a floating window (the Q&A list itself is unchanged) showing a mind map of all visible Q&As of the paper. A follow-up hangs under its parent *question*; which of the parent's answers it continued does not affect the layout. Clicking a node opens its thread in the conversation view (when available).
- **One floating-window mechanism**: note editor windows, the Q&A tree window, and the floating question box share one window store (stacking, geometry, per-kind size memory) and one shell component (`FloatingWindow`); any number can be open at once.
- **One model per question**: the question box (floating or docked) selects exactly one model; picking another model replaces the selection. Regenerating an existing entry keeps its multi-model dialog.

## Capabilities

### New Capabilities
- `qa-conversation-view`: the conversation side column, derived threads, tabs, docked question box behaviour.
- `qa-tree-view`: the Q&A mind map grouped by parent question, in a floating window; the shared floating-window mechanism.

### Modified Capabilities
- `qa-model-persist`: the question box keeps a single selected model.
- `qa-input-floating`: the floating panel yields to the docked box while the conversation view is open; model selection is single-choice.

## Impact

- Frontend only: `views/PaperDetail.vue` (layout selector, conversation layouts), `components/PaperViewerPanel.vue` (optional Metadata and Q&A tabs), `composables/useBlockAnchor.ts` (activates that tab before revealing an entry), `components/QAInput.vue` (docked mode, single model), new `components/QAConversationPanel.vue`, `components/QAThreadView.vue`, `components/QATreeView.vue`, new composable `composables/useQAConversation.ts`, `components/QAList.vue` / `QAResultBody.vue` (open-in-conversation action, tree window button), `stores/windows.ts` (generalized to all floating windows), new `components/FloatingWindow.vue` + `components/FloatingWindowHost.vue` (replacing `notes/FloatingNoteWindow.vue` + `notes/NoteWindowHost.vue`), `composables/useQAWindow.ts` (now backed by the shared store), `stores/qa.ts` (single-model normalisation).
- Uses the existing `GET /api/qa/entries/:id/tree` endpoint; no backend, API, or schema change.
- Docs: `docs/frontend-architecture.md`.
