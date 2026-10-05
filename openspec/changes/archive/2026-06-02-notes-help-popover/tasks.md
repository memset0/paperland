## 1. Help dialog

- [x] 1.1 Add a `components/notes/NoteHelpDialog.vue` that renders (via `components/ui/dialog`) a help dialog with two sections: (a) mind-map syntax — headings → nodes by relative depth, heading body = node content, a leading `>` blockquote → a read-only content node (text / image / formula), consecutive leading blockquotes → multiple content nodes (with small Markdown examples); (b) PDF → image link — Crop tool, drag a region, release → uploaded image + paste-ready `[![](url)](paperland://…?pdf=…)` link on the clipboard. Takes an `open` model (or exposes open/close).

## 2. Function-bar control

- [x] 2.1 In `components/notes/NoteWalkthrough.vue`, add a "?" icon button (lucide `CircleHelp`) to the function bar (next to the mode/pop-out controls) that opens the help dialog; mount `NoteHelpDialog` and wire its open state.

## 3. Docs

- [x] 3.1 Note the help "?" control in `docs/frontend-architecture.md` (notes panel section).

## 4. Verify

- [x] 4.1 `vue-tsc --noEmit` clean.
- [ ] 4.2 Manual QA: the "?" opens the dialog; both sections read correctly; dialog dismisses; the note panel is unaffected.
