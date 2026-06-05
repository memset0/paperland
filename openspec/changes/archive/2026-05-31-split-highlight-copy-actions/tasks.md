## 1. Split the copy handlers

- [x] 1.1 In `packages/frontend/src/components/MarkdownContent.vue`, rename `copyAnchorLink()` to `copyContentAndAnchorLink()`, keeping its body (Markdown conversion + trailing `[#](paperland://…)` link) and toast ("已复制内容和锚点链接") unchanged.
- [x] 1.2 Add `copyAnchorLinkOnly()`: build the same `paperland://paper/<id>?h=<hash>&s=<start>&e=<end>` URL, write `[#](<url>)` (a plain link, no leading `!`) to the clipboard, show a distinct toast ("已复制锚点链接"), clear the selection, and close popups — mirroring the existing handler's guards (`pendingSelection`/`contentHash`/`paperId`) and teardown.

## 2. Toolbar UI

- [x] 2.1 Import `Copy` from `@lucide/vue` alongside the existing `Link2`.
- [x] 2.2 In the selection toolbar template, change the existing copy button to call `copyContentAndAnchorLink` and use the `Copy` icon (title "复制内容和锚点链接").
- [x] 2.3 Add a second toolbar button that calls `copyAnchorLinkOnly`, keeps the `Link2` icon (title "复制锚点链接"), and is gated behind `v-if="paperId"` like the first.

## 3. Verify behavior

- [x] 3.1 In the running app, select text in a Q&A answer / note preview: confirm the `Copy` button copies `<markdown> [#](paperland://…)` (unchanged from before) and the `Link2` button copies exactly `[#](paperland://…)` (plain link, no `!`) with no content.
- [x] 3.2 Confirm both buttons are hidden for anonymous users and that each shows its own toast.

## 4. Docs & spec sync

- [x] 4.1 Update `docs/frontend-architecture.md` highlight-toolbar description ("浮动工具栏（4 色 + 复制为锚点链接）") to reflect the two copy actions (content+link with the copy icon, link-only plain `[#]` with the link icon).
- [x] 4.2 Re-read the proposal/specs against the final implementation; fold any tweaks back into this change's artifacts before archiving.
