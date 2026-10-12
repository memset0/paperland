## 1. Question box

- [x] 1.1 `QAInput`: remove the floating window mode and close button; add the inline look; scroll into view + focus on `composer.openRequests`
- [x] 1.2 `QAList`: inline `QAInput` under the User Q&A header when the conversation view is not visible
- [x] 1.3 Remove `useQAWindow.ts`, the `qa-ask` window kind, `PaperActionLauncher.vue`, and `PaperDetail`'s floating box / launcher / `openQA`

## 2. Conversation view on phones

- [x] 2.1 `useQAConversation`: mobile mode (`setAvailable(available, mobile)`, `showRequests`)
- [x] 2.2 `PaperDetail`: bottom bar Info / Read / Q&A (list icon) / Ask section with the lazily mounted `QAConversationPanel`; open requests and `showRequests` pick the section
- [x] 2.3 `QAConversationPanel`: no close-view button on phones

## 3. Docs and verification

- [x] 3.1 Update `docs/frontend-architecture.md` (and check `tech-stack.md`)
- [x] 3.2 Type-check, verification build, browser e2e (desktop inline box + follow-up, conversation routing to existing/new tab, phone Ask section, open-in-conversation and follow-up from the phone Q&A list)
