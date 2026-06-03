## 1. Dependency & Monaco bootstrap

- [x] 1.1 Add `monaco-editor` to `packages/frontend/package.json` and install (`bun install`).
- [x] 1.2 Create `src/lib/monaco.ts` lazy bootstrap (mirrors `lib/pdfjs.ts`): set `self.MonacoEnvironment.getWorker` from `monaco-editor/esm/vs/editor/editor.worker?worker`; dynamically `import()` `editor.api` + the Markdown grammar module; register Markdown ourselves (`register` + `setLanguageConfiguration` + `setMonarchTokensProvider`, **not** the lazy `.contribution`); define transparent light/dark themes. Exposes `loadMonaco()` + `monacoThemeFor()`.
- [x] 1.3 Update `packages/frontend/vite.config.ts` with `worker: { format: 'es' }` for the Monaco worker; dev/build start with no worker errors.
- [x] 1.4 Extend the Markdown Monarch grammar in `extendMarkdown()`: **LaTeX math** (`$…$` inline single-line whole-match with a no-space guard; `$$…$$` block state that also tokenizes `\commands`/braces) with per-theme color `rules` for the `*.math` tokens; **image-in-link anchors** `[![alt](img)](link)` matched as one link so the brackets' colors match (Monaco's built-in rule stops at the inner image's `]`). Add the ambient module declaration for the untyped markdown grammar import in `env.d.ts`.

## 2. Shared Monaco Markdown editor component

- [x] 2.1 Create `src/components/notes/MonacoMarkdownEditor.vue` that calls `loadMonaco()` in `onMounted` and shows a container-sized placeholder until ready.
- [x] 2.2 Implement the `v-model` contract: prop `modelValue`; emit `update:modelValue` on `onDidChangeModelContent`; guard external `modelValue` → `setValue` so it does not feed back, preserving cursor.
- [x] 2.3 Configure prose-oriented options: `language: 'markdown'`, `wordWrap: 'on'`, **`lineNumbers: 'on'`** (line numbers shown), no minimap, no folding/glyph margin, `renderLineHighlight: 'none'`, `quickSuggestions: false`, `occurrencesHighlight: 'off'`, unicode-highlight off, `fontSize: 14`, mono font, `automaticLayout: true`.
- [x] 2.4 Emit the parent-facing events: `compositionstart`/`compositionend` (Monaco composition events — also used to suppress `update:modelValue` mid-IME), `blur`, `save` (Ctrl/Cmd+S command), and `paste` (native `ClipboardEvent` from the inner `textarea.inputarea`).
- [x] 2.5 Expose imperative helpers via `defineExpose`: `insertAtCursor(text)`, `focus()`, `getEditor()`.
- [x] 2.6 Read `stores/theme.ts`, set the theme on mount and `watch(theme.resolved)` to reskin live (light/dark, including the math token colors).
- [x] 2.7 Dispose the editor and remove listeners on `onBeforeUnmount`.

## 3. Wire into the floating editor windows (NoteEditor.vue)

- [x] 3.1 Replace the `<textarea>` with `<MonacoMarkdownEditor>` bound to `editBody`, filling its flex container in editor/split modes.
- [x] 3.2 Re-wire onto the component events: `@update:model-value` → set `editBody` + `scheduleSave`; `@compositionstart/@compositionend` → existing IME guard; `@blur`/`@save` → `commit`; heading demotion + conflict detection in `commit` unchanged.
- [x] 3.3 Move the paste-to-upload handler onto `@paste` and use `insertAtCursor()` to drop the uploaded Markdown image link at the cursor, then `commit()`.
- [x] 3.4 Demotion stays visible via the preview pane (editBody keeps raw text; `previewContent` renders demoted), as before.

## 4. Wire into the left-panel editor (NoteWalkthrough.vue)

- [x] 4.1 Replace the `<textarea>` with `<MonacoMarkdownEditor v-model="bodyModel">` in edit/split modes; the wrapper's mid-composition suppression preserves the previous "no store write during IME" behavior.
- [x] 4.2 Mode switching (edit/split/render) and the "locked to render while whole-document floating editor open" rule are unchanged.

## 5. Verification

- [x] 5.1 Build-level: `vue-tsc --noEmit` is clean and `vite build` succeeds; `editor.api`, the Markdown grammar, and `editor.worker` emit as **separate async chunks** (Monaco lazy-loaded, not in the initial/`PaperDetail` bundle) with no worker errors — satisfies the lazy-load requirement.
- [ ] 5.2 Live (run `bun run dev`): confirm Markdown + LaTeX math syntax highlighting and line numbers appear in a section window, the whole-document window, and the left-panel edit/split editor.
- [ ] 5.3 Live: autosave — edit and close a window before the debounce → change persists; blur/Enter commit immediately.
- [ ] 5.4 Live: IME — type Chinese pinyin → no mid-composition write-through, no revert.
- [ ] 5.5 Live: paste an image → uploads and inserts the Markdown link at the cursor.
- [ ] 5.6 Live: section-window heading demotion (`#` → bold) and conflict detection still trigger; theme toggle reskins the editor (incl. math colors) live.

## 6. Docs

- [x] 6.1 Update `docs/frontend-architecture.md` (note editor section) — shared `MonacoMarkdownEditor`, two call sites, line numbers, LaTeX math, lazy-load.
- [x] 6.2 Update `docs/tech-stack.md` — add the `monaco-editor` dependency row.
