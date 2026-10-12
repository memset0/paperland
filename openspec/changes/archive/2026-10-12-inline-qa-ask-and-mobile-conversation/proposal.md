## Why

The floating "Ask" panel is a detour: users open it from a button, it covers the paper, and on phones it is a full-screen overlay unrelated to the conversation view built for desktop. Asking should happen where the Q&A lives (desktop without the conversation view) or in the conversation view (desktop with it, and phones).

## What Changes

- **Desktop, no conversation view (split layout, and embed)**: the question box is an inline box at the top of the User Q&A card instead of a floating window. Follow-ups, PDF "Add to question" and `#moonlight` links put their content into this box and scroll it into view.
- **Desktop with the conversation view (paper + conversation, three columns)**: unchanged single docked box; the inline box is not shown. A follow-up opens the answer's thread in the existing tab whose last answer it is, or in a new tab.
- **BREAKING (UI)**: the floating question window and the top-right "Ask" button are removed (the paper action launcher goes away); phones no longer get the full-screen Ask overlay.
- **Phones (mobile bottom bar)**: four items — Info and Read unchanged; **Q&A** (the Q&A list, now with a list icon); **Ask** becomes a section showing the conversation view (thread tabs, docked box) instead of an action. "Open in conversation", follow-ups, `#moonlight`, and "Add to question" switch to Ask and land in the matching tab. Signed-out visitors keep three items.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `qa-input-floating`: floating panel requirements removed; inline box above User Q&A added; top row loses the close button.
- `paper-action-launcher`: retired (no functions left in the launcher).
- `mobile-bottom-bar`: paper detail gets an Ask section with the conversation view; Q&A item uses a list icon.
- `qa-conversation-view`: available on phones as the Ask section; the shared box is the inline box (not a floating one) when the view is not shown; follow-ups land in the matching tab or a new one.
- `qa-tree-view`: the shared floating-window mechanism no longer includes the question box.

## Impact

- Frontend only: `components/QAInput.vue` (inline / docked only), `components/QAList.vue` (inline box in the User Q&A card), `views/PaperDetail.vue` (no launcher / floating box; mobile Ask section), `composables/useQAConversation.ts` (mobile mode), `components/QAConversationPanel.vue` (no close button on phones), `stores/windows.ts` (drop `qa-ask`), removed `composables/useQAWindow.ts` and `components/PaperActionLauncher.vue`.
- No backend, API, or schema change.
- Docs: `docs/frontend-architecture.md`, `docs/tech-stack.md` if affected.
