## Context

Note editing today uses a plain `<textarea>` in two components:

- `components/notes/NoteEditor.vue` — the floating section / whole-document
  editor windows. It owns a local `editBody` ref bound with `v-model`, a 1200 ms
  debounced write-through (`scheduleSave`/`commit`), IME composition guards
  (`onCompositionStart`/`onCompositionEnd`), `Ctrl/Cmd+S` to commit, a paste
  handler that uploads images and inserts a Markdown link at the cursor,
  section-window heading demotion via `demoteHeadings()` (from `lib/markdown-doc.ts`),
  and conflict detection that captures the structure key + section baseline at
  open.
- `components/notes/NoteWalkthrough.vue` — the left-panel full-document editor in
  edit/split mode. It binds a `bodyModel` `v-model` over the whole document and
  shares the edit/split/render mode switching.

Both textareas render with `font-mono text-sm bg-transparent resize-none`.
Preview is the existing `MarkdownContent.vue` (markdown-it + KaTeX), reused
side-by-side in split mode. There is a theme store (`stores/theme.ts`) and an
in-flight dark-mode change.

The behaviors above are not incidental — most are pinned by the
`note-editor-window` and `notes-walkthrough` specs (reliable autosave, IME guard,
heading demotion, three display modes). The editor swap must keep all of them.

Stack constraints: Vue 3.4, Vite 5.4, Bun. No Monaco, CodeMirror, or any code
editor exists in the repo today; Vite has no worker configuration yet.

## Goals / Non-Goals

**Goals:**

- Replace the two note-editing textareas with a Monaco editor that has Markdown
  syntax highlighting.
- Do it once: a single shared wrapper component used by both call sites, so the
  autosave/IME/paste/demotion/conflict logic stays in the parents and is not
  duplicated.
- Zero functional regression against the current note behaviors and the existing
  specs.
- Keep the initial bundle/first-paint cost unchanged (Monaco is heavy).
- Follow the app's light/dark theme.

**Non-Goals:**

- No new editor features beyond syntax highlighting (no IntelliSense/markdown
  autocompletion, no command palette, no minimap, no inline lint, no
  collaborative cursors).
- No change to the preview pipeline (`MarkdownContent`), the mind-map, the
  shared-editing/persistence model, conflict semantics, or any backend/API.
- Not introducing a third-party Vue-Monaco wrapper dependency.
- No change to where headings are demoted or how conflicts are detected — those
  stay exactly as today.

## Decisions

### D1: Official `monaco-editor`, wrapped in our own thin Vue component

Add the official `monaco-editor` package and write
`components/notes/MonacoMarkdownEditor.vue` ourselves rather than pulling a
community wrapper (`@guolao/vue-monaco-editor`, `monaco-editor-vue3`, …).

- **Why**: the call sites have non-trivial, project-specific needs — IME-aware
  debounce, paste-to-upload at the cursor, write-through-on-blur, programmatic
  cursor insertion, heading demotion reflected back into the editor. A thin
  self-owned wrapper gives full access to the `IStandaloneCodeEditor` instance
  and its events with no abstraction fighting us, and one fewer dependency to
  track.
- **Alternative considered**: a Vue-Monaco wrapper lib — rejected: extra dep,
  and these wrappers tend to hide exactly the editor/DOM hooks (inner textarea,
  composition events, paste) we need.

### D2: Shared wrapper owns the editor; parents keep the behavior

`MonacoMarkdownEditor.vue` exposes a `v-model`-style contract and emits the
events the parents already react to, so almost no logic moves:

- Props: `modelValue: string`, plus presentation options (`readonly?`,
  `wordWrap?`, etc. with prose defaults).
- Emits: `update:modelValue` (on content change), `compositionstart`,
  `compositionend`, `blur`, `save` (Ctrl/Cmd+S), and `paste` (the native
  `ClipboardEvent`, for image upload).
- Exposes via `defineExpose`: `insertAtCursor(text)`, `focus()`, and
  `getEditor()` so a parent can read selection / replace a range when inserting
  an uploaded image link.

The parents' existing `scheduleSave`/`commit`/composing/conflict/demotion logic
is reused verbatim against these events. This keeps the spec-pinned behaviors in
place and makes the swap a near-mechanical template change.

- **Event sourcing**: Monaco provides first-class hooks for everything needed —
  `onDidChangeModelContent` → `update:modelValue`; `onDidCompositionStart` /
  `onDidCompositionEnd` → composition events (so the IME guard keeps working);
  `onDidBlurEditorWidget` → `blur`; `addCommand(KeyMod.CtrlCmd | KeyCode.KeyS)` →
  `save`. The native `paste` listener is attached to Monaco's hidden input
  textarea (`editor.getDomNode().querySelector('textarea.inputarea')`) so we get
  `clipboardData` with image blobs, exactly as today.

### D3: Lazy-load Monaco, minimal ESM surface

Monaco is multi-MB. A `lib/monaco.ts` bootstrap (mirroring `lib/pdfjs.ts`)
dynamically `import()`s the minimal ESM surface — the editor API plus Monaco's
Markdown Monarch grammar module — rather than the full `monaco-editor` barrel
that bundles every language. The wrapper calls `loadMonaco()` in `onMounted`:

```ts
const monaco = await import('monaco-editor/esm/vs/editor/editor.api')
const md = await import('monaco-editor/esm/vs/basic-languages/markdown/markdown') // { conf, language }
```

We register Markdown **ourselves** (`monaco.languages.register` +
`setLanguageConfiguration` + `setMonarchTokensProvider`) instead of importing
`markdown.contribution`, because the contribution installs a *lazy* tokenizer
loader that fires on first editor creation and would overwrite our math-extended
grammar (see D8). While loading, the wrapper renders a lightweight placeholder
sized to the container (no layout jump). This keeps Monaco out of the initial
bundle as an async chunk and avoids shipping JSON/TS/CSS/etc. tokenizers we never
use.

- **Alternative considered**: eager top-level import — rejected: balloons the
  initial bundle for a surface most page-views never touch. Loading the full
  `monaco-editor` barrel — rejected: pulls all basic languages.

### D4: Vite worker configuration (editor worker only)

Monaco needs `self.MonacoEnvironment.getWorker`. Markdown has **no dedicated
language-service worker** — only the base editor worker is required. Configure it
once in a small module imported by the wrapper, using Vite's `?worker` import:

```ts
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
self.MonacoEnvironment = { getWorker: () => new EditorWorker() }
```

No `ts.worker`/`json.worker`/etc. are wired up, since no such languages are used.
If Vite needs help pre-bundling, add `monaco-editor` to `optimizeDeps` and/or set
`worker.format: 'es'` in `vite.config.ts`; the worker import above is the
canonical Vite + Monaco pattern.

### D5: Prose-oriented editor options

Configure Monaco to feel like the prose textarea it replaces, not an IDE:

- `language: 'markdown'`, `wordWrap: 'on'` (textarea wrapped), `wrappingIndent:
  'same'`.
- `minimap: { enabled: false }`, `lineNumbers: 'on'` (line numbers are shown —
  per product decision), `lineNumbersMinChars: 3`, `folding: false`,
  `glyphMargin: false`, `lineDecorationsWidth: 8`, `renderLineHighlight: 'none'`,
  `overviewRulerLanes: 0`, `scrollBeyondLastLine: false`.
- `quickSuggestions: false`, `suggestOnTriggerCharacters: false`,
  `occurrencesHighlight: 'off'`, `unicodeHighlight` ambiguous/invisible off
  (Chinese notes must not be flagged).
- `fontSize: 14` (≈ `text-sm`), `fontFamily` matching the app mono stack,
  `padding: { top, bottom }` to match the textarea's `p-3`/`p-4`.
- `automaticLayout: true` so the editor relayouts inside resizable floating
  windows and the 50% split pane without manual `ResizeObserver` wiring.

### D6: Theme-aware, blends into the panel

Define two Monaco themes — a light one (`base: 'vs'`) and a dark one (`base:
'vs-dark'`) — whose `editor.background` is transparent (or matches the note
panel) so the editor blends in like the old `bg-transparent` textarea. Read the
theme store and call `monaco.editor.setTheme(...)` on mount and reactively
`watch` the theme so toggling dark mode reskins the editor live.

### D8: Grammar extension for math + image-in-link anchors

`lib/monaco.ts` defines `extendMarkdown(base)` that clones Monaco's Markdown
Monarch `language` and **prepends rules to its `linecontent` state** (reached both
at line start and mid-line via root's `@linecontent` include) so they win over the
originals; the rest of the grammar is the unchanged original, so no Markdown
highlighting regresses. It adds two things:

**LaTeX math** — Monaco's built-in grammar does not tokenize `$…$` / `$$…$$`, so
KaTeX math would show as plain text:

- block math `$$…$$` → a stateful `latexBlock` region (may span lines) that also
  tokenizes `\commands` (`type.identifier.math`) and braces;
- inline math `$…$` → a single-line whole-match token, with a no-space-just-inside
  guard (`$(?=[^\s$])…[^\s$]$`) so prose like "$5 and $10" is not mistaken for math.

Math tokens (`keyword.math`, `string.math`, `type.identifier.math`, …) are colored
by per-theme `rules` in our light/dark themes (D6), so math stands out and re-skins
with the app theme.

**Image-in-link anchors** `[![alt](imgUrl)](linkUrl)` (paperland's PDF-region /
image-host anchors) — Monaco's built-in link rule
`(!?\[)((?:[^\]\\]|@escapes)*)(\]\([^\)]+\))` stops at the **inner image's** `]`, so
it consumes only `[![alt](imgUrl)` and link-colors the outer `[`, leaving the
trailing `](linkUrl)` as plain text — the opening and closing brackets visibly
mismatch in color. A prepended rule matches the whole shape
`(\[!\[)([^\]]*)(\]\()([^)]*)(\)\]\()([^)]*)(\))` and colors every delimiter + both
URLs as `string.link` (alt text default), so the anchor highlights consistently.
The rule only matches the full `[![…](…)](…)` shape, so plain images/links are
unaffected.

- **Why extend, not replace**: cloning + prepending preserves Monaco's full
  Markdown grammar (headers, code fences, links, lists) and only adds these cases.
- **Alternatives considered**: a separate embedded `latex` language — Monaco ships
  none in basic-languages; decoration-based span coloring — doesn't integrate with
  theming or tokenize commands. Rejected in favor of the grammar extension.

### D7: Demotion, conflict, and persistence are untouched

Heading demotion still happens on write-through in the parent's `commit()`
(section windows only), conflict detection still captures the structure key /
baseline at open, and the shared-document write-through is unchanged. When a
commit normalizes the text (e.g. demotes a heading), the parent sets the editor
content to the normalized value just as it set `editBody` today, so the
normalization stays visible — satisfying the existing "make normalization
visible" requirement. Monaco only changes how text is displayed and entered.

## Risks / Trade-offs

- **Bundle weight** → Lazy-load + minimal ESM imports + a placeholder keep
  Monaco off the critical path; it is an on-demand async chunk loaded only when a
  note editor mounts.
- **Vite worker wiring is the classic failure point** (blank editor / "missing
  worker" console error) → Use the documented `?worker` import and the
  `MonacoEnvironment.getWorker` shim; verify in dev that highlighting works and no
  worker error appears before archiving.
- **IME composition regressions** (the existing specs explicitly require no
  mid-composition write-through and no revert) → Drive the parents' existing
  composing guard from Monaco's `onDidCompositionStart/End` and verify Chinese
  pinyin input doesn't lose or revert text.
- **Paste-to-upload depends on a private DOM detail** (Monaco's inner
  `textarea.inputarea`) → Attach the `paste` listener defensively (null-check the
  query) and fall back to `editor.onDidPaste` for plain text; cover the image
  paste path in manual verification.
- **`automaticLayout` cost / zero-height container** → Monaco needs a sized
  container; ensure the wrapper fills its flex parent (`min-h-0`, `flex-1`) in
  both the floating window and the split pane so it isn't measured at 0 height.
- **Touch / mobile** (floating window is a fullscreen overlay on mobile) →
  Monaco supports touch but is heavier than a textarea; verify scrolling and IME
  on a touch viewport. If it proves unusable on mobile, a `<textarea>` fallback
  for touch devices is a cheap escape hatch (kept in mind, not built up front).
- **Two-way binding feedback loop** → Guard `setValue` so external `modelValue`
  updates don't re-emit `update:modelValue`; only push external changes into the
  editor when they differ from its current value, preserving cursor where
  possible.

## Migration Plan

Pure frontend, additive, reversible:

1. Add `monaco-editor`; add the worker env module and `vite.config.ts` worker
   config.
2. Build `MonacoMarkdownEditor.vue` and verify it standalone.
3. Swap the textarea in `NoteEditor.vue`, wiring its events to the existing
   commit/composing/paste/demotion logic; verify the floating windows.
4. Swap the textarea in `NoteWalkthrough.vue`; verify edit/split/render.
5. Update docs.

Rollback is reverting the two component swaps back to `<textarea>` (the wrapper
and dependency can stay dormant). No data or API migration.

## Open Questions

- Inline `$…$` math is highlighted as a single token (delimiters + content one
  color); only block `$$…$$` math tokenizes inner `\commands` individually. If
  inline command-level coloring is later wanted, inline math would need a bounded
  single-line state. Acceptable for now — inline math is short.
