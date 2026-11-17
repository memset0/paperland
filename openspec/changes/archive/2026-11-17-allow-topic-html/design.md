# Design

## Decisions

- **Opt-in renderer.** `renderMarkdown(source, { html: true })` uses a second markdown-it instance (same plugins and video rule) with `html: true`, then sanitizes the output. The default call is unchanged.
  - Only Topic surfaces pass `allow-html` to `MarkdownContent`.
  - Q&A answers, notes and parsed paper text come from models or external sources and are shown in other contexts, so they keep `html: false`.
- **Sanitizer.** We use DOMPurify's HTML, SVG and MathML profile.
  - KaTeX output survives: spans with inline styles, and MathML.
  - The video rule's `playsinline` is kept via `ADD_ATTR`.
  - These are forbidden: `style`, `iframe`, `object`, `embed`, `form`, `input`, `button`, `textarea`, `select`.
  - A hook removes the `style` attribute when it sets `position: fixed` or `position: sticky`. That stops a pushed page from overlaying the app UI.
  - `data-*` attributes are kept: the image width directive uses `data-alt`.
- **Why sanitize at all.** Topic content comes from Git pushes by editors and from Plugins services (external apps), and other members view it. Without sanitizing, raw HTML would let one member run scripts in another member's logged-in session.
- **Reading diff.** `topic-reading.ts` keeps the same block grammar as the renderer, so its parser also sets `html: true`.

## Risks

- Inline `style` can still restyle content inside the card, or load background images from external URLs. That is the same exposure Markdown images already have; accepted.
