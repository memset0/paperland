## Why

The note editor currently uses a plain `<textarea>` in two places — the floating
editor windows (`NoteEditor.vue`) and the left-panel edit/split mode
(`NoteWalkthrough.vue`). A bare textarea gives no syntax highlighting, so longer
Markdown notes (headings, code fences, math, links, lists, blockquotes) are hard
to scan and edit. Replacing the textarea with the **Monaco editor** (the editor
that powers VS Code) gives proper Markdown syntax highlighting and a far better
editing surface, while keeping every existing note behavior intact.

## What Changes

- Introduce a **shared Monaco-based Markdown editor** component and use it to
  replace the two `<textarea>` editors used for note editing:
  - the floating section / whole-document editor windows (`NoteEditor.vue`)
  - the left-panel edit/split mode editor (`NoteWalkthrough.vue`)
- The editor provides **Markdown syntax highlighting** (headings, emphasis,
  inline/fenced code, lists, links, blockquotes, etc.), **including LaTeX math**
  — Monaco's Markdown grammar is extended so KaTeX `$…$` / `$$…$$` math is
  highlighted instead of shown as plain text.
- **Theme-aware**: a light/dark Monaco theme follows the app theme and blends
  into the surrounding note panel.
- **Preserve all current editing behaviors** — there is no functional
  regression:
  - write-through autosave with a 1200 ms debounce;
  - commit on blur, on Enter, and on window close;
  - IME-composition guard (no write-through mid-composition);
  - Ctrl/Cmd+S explicit commit;
  - paste-to-upload: pasted images upload and insert a Markdown image link at the
    cursor;
  - section-window heading demotion (`#` → bold) on write-through;
  - cross-tab / structure-change conflict detection.
- Monaco is **lazy-loaded** (dynamic import) and its editor web-worker is
  configured for Vite, so the initial bundle and first paint are unaffected.
- **Prose-oriented chrome**: word-wrap on, line numbers shown, no minimap, no
  code-completion popups.
- Add `monaco-editor` as a frontend dependency and the Monaco worker
  configuration to the frontend build.

No backend, API, or data-model changes.

## Capabilities

### New Capabilities

- `notes-code-editor`: The note-editing surface is a Monaco-based Markdown editor
  with syntax highlighting — theme-aware, lazy-loaded, and shared by both the
  floating editor windows and the left-panel edit/split editor — that upholds the
  existing autosave / IME / paste / heading-demotion / conflict behaviors. This
  capability specifies the concrete editor that the existing `note-editor-window`
  and `notes-walkthrough` capabilities require ("a Markdown editor"); those
  capabilities' requirements remain satisfied.

### Modified Capabilities

<!-- None. The existing `note-editor-window` and `notes-walkthrough` specs require
     "a Markdown editor" / "a Markdown text editor" generically, which Monaco
     satisfies; no requirement in those specs changes. The new behavior (syntax
     highlighting, the concrete editor) is captured by the new `notes-code-editor`
     capability above. -->

## Impact

- **Frontend code**: new `packages/frontend/src/components/notes/MonacoMarkdownEditor.vue`
  (shared wrapper); modified `NoteEditor.vue` and `NoteWalkthrough.vue` to mount
  it in place of `<textarea>`; a small Monaco worker-environment setup module;
  Monaco worker config in `packages/frontend/vite.config.ts`.
- **Dependencies**: add `monaco-editor` to `packages/frontend`. Lazy-loaded, so it
  becomes an async chunk rather than weight on the initial bundle.
- **Docs**: update `docs/frontend-architecture.md` (note editor section) and
  `docs/tech-stack.md` (new dependency).
- **No** backend, External API, DB, or config.yml changes.
