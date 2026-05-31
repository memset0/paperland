## Why

The Markdown highlight selection toolbar currently has a single copy button (the `Link2`
icon → `copyAnchorLink`) that copies the **selected content as Markdown plus a trailing
`[#](paperland://…)` anchor**. There is no way to grab *just* the positioning link without
the content. When all you want is a compact, embeddable reference to a spot in a paper, you
have to copy the whole selection and then hand-delete the text. Splitting the one action into
two — "content + link" and "link only" — covers both needs directly from the toolbar.

## What Changes

- Split the highlight selection toolbar's single copy action into **two buttons**:
  - **Copy content + anchor link** — the *current* behavior unchanged (`<markdown> [#](paperland://…)`),
    but moved onto a **new icon**: the conventional "copy" glyph (`Copy`, two overlapping squares).
  - **Copy anchor link only** — a *new* action that copies **only** the positioning link, wrapped in
    Markdown **image** syntax: `![#](paperland://paper/<id>?h=<hash>&s=<start>&e=<end>)`. This keeps the
    **current** `Link2` icon.
- Each action shows its own distinct success toast (e.g. "已复制内容和锚点链接" vs "已复制锚点链接").
- The `paperland://` link scheme/format itself is unchanged — only the Markdown wrapper around the
  URL differs between the two actions (`[#]` link form vs `![#]` image form).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `markdown-highlight`: the "Copy an anchor link from a selection" requirement is split into two
  toolbar actions (content+link vs link-only) with distinct icons and clipboard formats; the
  "Toolbar has no note input" scenario is updated to reference the copy actions in the plural.

## Impact

- **Code**: `packages/frontend/src/components/MarkdownContent.vue` — split `copyAnchorLink()` into
  two handlers, add the `Copy` icon import, add a second toolbar button.
- **Docs**: `docs/frontend-architecture.md` — the highlight toolbar description
  ("浮动工具栏（4 色 + 复制为锚点链接）") gains the second copy action.
- **No backend / API / DB / config changes.** `markdown-anchors` (the `paperland://` scheme) is
  unaffected.
- **Known limitation (out of scope)**: the new `![#](paperland://…)` *image* form is not yet
  rendered as a clickable in-app anchor — only the `[#]` *link* form is intercepted by
  `MarkdownContent`. The image form is a deliberate "embed marker" for the copied link; rendering
  it as a clickable/embedded element is a possible follow-up, not part of this change.
