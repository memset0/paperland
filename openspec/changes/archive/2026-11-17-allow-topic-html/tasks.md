# Tasks

- [x] 1.1 Add the opt-in HTML renderer with the DOMPurify sanitizer to `markdown-renderer.ts`; offline tests with jsdom (span kept, unsafe HTML removed, default renderer unchanged, KaTeX and video survive).
- [x] 1.2 Add `allowHtml` to `MarkdownContent`, pass it from Topic page bodies, directory descriptions and entry comments, and set `html: true` in `topic-reading.ts`; type-check.
- [x] 1.3 Update docs; build and deploy the frontend; verify in the browser on production.
