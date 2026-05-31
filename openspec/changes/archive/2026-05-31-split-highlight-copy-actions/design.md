## Context

`MarkdownContent.vue`'s selection toolbar (the same floating bar that offers the 4 highlight
colors) currently exposes one copy action, `copyAnchorLink()`, behind a `Link2` icon. It copies:

```
<selection-as-markdown> [#](paperland://paper/<id>?h=<hash>&s=<start>&e=<end>)
```

i.e. the full selection converted back to Markdown followed by a trailing `[#]` anchor link.
Users sometimes want *only* the positioning link — a compact handle to a spot in a paper — without
dragging the content along. Today that requires copying the whole thing and deleting the prose.

This change splits the single action into two toolbar buttons. It is a small, frontend-only,
single-component change, but it touches a behavior that is specified (`markdown-highlight` →
"Copy an anchor link from a selection"), so it goes through the spec workflow.

## Goals / Non-Goals

**Goals:**
- Two distinct copy actions in the selection toolbar, each with its own icon and toast:
  - **Content + link** (existing behavior, unchanged output) → conventional **`Copy`** icon.
  - **Link only** → keeps the existing **`Link2`** icon, copies `![#](paperland://…)` (image form).
- Preserve the existing content+link clipboard format byte-for-byte (Markdown conversion, math
  reconstruction, GFM tables) — only the *icon* changes for that action.
- Keep both actions login-gated exactly as the single action is today.

**Non-Goals:**
- Changing the `paperland://` URL scheme or its parameters (`markdown-anchors` is untouched).
- Rendering the `![#](paperland://…)` image form as a clickable / embedded in-app anchor. Only the
  `[#]` link form is intercepted today; the `![#]` form is a copied "embed marker" whose rendering
  is a separate, future concern (see Risks).
- Any change to the PDF viewer's "复制选区链接" floating button (`PdfViewer.vue`) — that's a
  different component and out of scope for this change.

## Decisions

### 1. Two buttons, not a dropdown
Add a second `<button>` to the toolbar's existing action area rather than a menu. The toolbar is
already a compact row (4 color swatches + 1 action); one more icon button is the lowest-friction,
most discoverable option and matches the existing single-row layout. A dropdown would add a click
and hide the less-used action.

### 2. Icon mapping (per the request)
- **Content + link** → `Copy` from `@lucide/vue` (the conventional two-overlapping-squares "copy"
  glyph). Verified present in the installed `@lucide/vue@^1.16`.
- **Link only** → keep the current `Link2` icon, so the previously-learned affordance ("the link
  icon copies a link") now maps to the pure-link action — which is arguably more intuitive than
  before, where `Link2` copied content+link.

### 3. Link-only uses Markdown **image** syntax `![#](…)`
The link-only output is `![#](paperland://paper/<id>?h=<hash>&s=<start>&e=<end>)` (note the leading
`!`), per the explicit request. Rationale for the image form over a plain `[#]` link: a bare `[#]`
link pasted on its own line renders as a tiny, easy-to-miss `#`; the image form is a deliberate,
visually distinct "embed marker" intended for future inline-region/preview rendering (it pairs with
the existing content-addressed image-host direction). The URL inside is identical to what the
content+link action emits — only the wrapper differs.

### 4. Implementation shape
Split `copyAnchorLink()` into two small handlers sharing URL construction:
- `copyContentAndAnchorLink()` — exactly today's `copyAnchorLink()` body (rename + keep behavior).
- `copyAnchorLinkOnly()` — builds the same `paperland://…` URL, writes `![#](<url>)`, fires its own
  toast, clears the selection, and closes popups (same teardown as the existing handler).

Both read `pendingSelection`, `contentHash`, and `props.paperId`, and both no-op when any is missing
(unchanged guard). The toolbar gates both buttons behind `v-if="paperId"` as today.

## Risks / Trade-offs

- **[The copied `![#](paperland://…)` does not render as a functional anchor]** → A pasted `![#]`
  becomes `<img src="paperland://…">`, which the browser shows as a broken image and which the
  `paperland://` click interceptor (scoped to `a[href^="paperland://"]`) does not handle. This is
  accepted for now: the copied string is correct Markdown and the link-only output is intended as an
  embed marker for a future rendering pass. Mitigation/follow-up: a later change can teach
  `MarkdownContent` to render `img[src^="paperland://"]` as a clickable chip or an embedded region
  preview. Called out in the proposal's Impact section so it isn't mistaken for a regression.
- **[Toolbar crowding on narrow mobile viewports]** → adding a second icon button widens the
  toolbar slightly. Low risk: the toolbar already clamps to the container bounds (existing
  "Toolbar viewport boundary clamping" requirement); two icon buttons + 4 swatches remain narrow.
- **[Muscle memory]** → users used to `Link2` copying content+link will now get link-only from that
  icon. Accepted: the new mapping (link icon → link only) is more intuitive, and the distinct toast
  text makes the result obvious immediately.
