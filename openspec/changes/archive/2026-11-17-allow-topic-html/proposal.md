# Proposal

## Why

Topic authors (the developer, or ChatGPT through a Plugins service) want inline HTML in Topic Markdown, for example `<span style="background:#fef08a">…</span>` to highlight text. Topic rendering currently runs markdown-it with `html: false`, so the tags show up as literal text.

## What Changes

- **Topic content renders raw HTML.** This covers Topic page bodies, directory descriptions and catalog entry comments.
- **The HTML is sanitized with DOMPurify** before it reaches the page:
  - scripts, event handlers, `javascript:` URLs, `<style>`, `<iframe>`, `<object>`, `<embed>` and form controls are removed;
  - `style` attributes stay, so colors and backgrounds work, but `position: fixed|sticky` is dropped so content cannot cover the app.
- **Other Markdown keeps HTML disabled.** That covers Q&A answers, notes and paper text.
- **Block splitting matches.** The Topic reading-diff parser uses the same `html` setting as the renderer, so new-block animation splits blocks the same way.

## Capabilities

### New Capabilities

### Modified Capabilities
- `topics`: Topic Markdown supports sanitized inline and block HTML.

## Impact

- Frontend:
  - `lib/markdown-renderer.ts`: an HTML-enabled renderer and a sanitizer;
  - `components/MarkdownContent.vue`: an `allowHtml` prop;
  - Topic views and components;
  - `lib/topic-reading.ts`.
- Dependencies: `dompurify` (runtime); `jsdom` (dev, for offline sanitizer tests).
- Docs: `frontend-architecture.md`, `tech-stack.md`, `topics.md`.
