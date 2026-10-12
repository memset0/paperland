## Context

`QAInput` currently has two modes: a floating window (shared `FloatingWindow` shell, `qa-ask` kind, opened by `PaperDetail.openQA` from the top-right launcher / the mobile bottom-bar Ask action / `composer.openRequests`) and `docked` inside `QAConversationPanel`. The draft lives in the `useQAComposer` singleton, so any single mounted `QAInput` can serve it. `useQAConversation` decides when the conversation view is shown (`available && layout ≠ split`), and is only available on the wide layout.

## Goals / Non-Goals

**Goals:** one place to ask on every layout (inline box or conversation view); phones get the conversation view as a bottom-bar section; remove the floating Ask window and the launcher.

**Non-Goals:** changing the conversation view itself, the threads, or the PDF selection toolbar's direct "Ask" (which answers in place).

## Decisions

- **Exactly one `QAInput` mounted**: inline in `QAList`'s User Q&A card (under its header) when `conversation.visible` is false, docked in `QAConversationPanel` when true. The composer's caret inserter is registered by whichever is mounted.
- **`QAInput` modes**: `docked` (conversation view, as today) or inline (a bordered block inside the card: Submit + model buttons row, follow-up line with cancel, attachment chips, 3-row textarea). The floating branch, close button and `useQAWindow` go away; `qa-ask` leaves `stores/windows.ts`.
- **Open requests**: `QAInput` (either mode) watches `composer.openRequests` and scrolls itself into view and focuses the textarea. `PaperDetail` additionally switches the phone section to Ask (signed in) or Q&A (signed out).
- **Mobile conversation**: `useQAConversation.setAvailable(available, mobile)`; with `mobile` the view counts as open regardless of the desktop layout, and `show()` bumps a `showRequests` signal instead of switching layouts. `PaperDetail` makes it available for signed-in users on the wide layout or the bottom-bar layout, and maps `showRequests` to the Ask section. The Ask section mounts `QAConversationPanel` lazily on first visit and then keeps it (v-show). The panel hides its "close view" button on phones.
- **Follow-up routing** stays `startFollowup → openThread` when the view is visible: an existing tab whose tail is the answer is activated, otherwise a blank new-conversation tab is reused or a tab is appended.
- **Bottom bar**: `info` (Info), `read` (BookOpen), `qa` (List icon), `ask` (MessagesSquare, section) — the last only when the conversation view is available.

## Risks / Trade-offs

- Adding a PDF passage on a phone before the Ask section was ever opened: no inserter is registered yet, so the token is appended to the draft text (existing fallback) and the section then opens with it.
