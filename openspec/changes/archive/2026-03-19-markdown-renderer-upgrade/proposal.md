## Why

The current markdown rendering (`MarkdownContent.vue` using `marked`) lacks math formula support — critical for a paper management app where QA results frequently contain LaTeX equations. Additionally, list bullet points are invisible due to Tailwind's base CSS reset (`list-style: none`) not being overridden, and the `prose` utility classes referenced in the template are non-functional because `@tailwindcss/typography` is not installed.

## What Changes

- **Add math formula rendering**: Integrate KaTeX with `marked` to support both inline (`$...$`, `\(...\)`) and display (`$$...$$`, `\[...\]`) math syntax
- **Fix list bullet styling**: Add explicit `list-style-type` rules for `<ul>` and `<ol>` to restore bullets/numbers hidden by Tailwind's base reset
- **Clean up unused prose classes**: Remove non-functional `prose prose-sm` classes from the template (no `@tailwindcss/typography` installed)
- **Apply MarkdownContent consistently**: Audit all views for raw `v-html` markdown rendering and replace with the improved `MarkdownContent` component where appropriate

## Capabilities

### New Capabilities
- `markdown-math-rendering`: KaTeX-based math formula rendering integrated into the markdown pipeline, supporting `$`, `$$`, `\(`, `\)`, `\[`, `\]` delimiters

### Modified Capabilities
- None

## Impact

- **Frontend dependencies**: New packages — `katex` (rendering engine), a marked-katex extension or custom `marked` extension
- **Component**: `packages/frontend/src/components/MarkdownContent.vue` — major update (KaTeX integration, CSS fixes)
- **CSS**: KaTeX stylesheet must be imported (either from node_modules or CDN)
- **Bundle size**: KaTeX adds ~300KB to the frontend bundle (fonts + JS); acceptable for an internal tool
- **No backend changes**: All rendering is client-side
- **No breaking changes**: Existing markdown content renders identically; math formulas that were previously shown as raw text will now render correctly
