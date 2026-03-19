## Context

The `MarkdownContent.vue` component currently uses `marked` (v17) to render markdown via `v-html`. It has two issues:

1. **No math support** — QA results from LLMs frequently contain LaTeX math (`$E=mc^2$`, `$$\int_0^1 f(x)dx$$`, `\(\alpha\)`, `\[\sum_{i=1}^n\]`), which render as raw text.
2. **Broken list styling** — Tailwind's `@tailwind base` (Preflight) resets `list-style: none` on all `<ul>`/`<ol>`. The component CSS sets `padding-left` but never restores `list-style-type`, so bullets/numbers are invisible. The `prose prose-sm` classes in the template are inert because `@tailwindcss/typography` is not installed.

This is a frontend-only change. The existing `MarkdownContent.vue` component is the single point of modification.

## Goals / Non-Goals

**Goals:**
- Render inline math (`$...$`, `\(...\)`) and display math (`$$...$$`, `\[...\]`) using KaTeX
- Fix list bullet/number visibility
- Clean, maintainable markdown styles that work with Tailwind's reset
- Keep the single `MarkdownContent.vue` component as the unified rendering point

**Non-Goals:**
- Installing `@tailwindcss/typography` — the component already has comprehensive custom styles; adding the plugin would create style conflicts
- Server-side rendering of math
- Syntax highlighting for code blocks (separate concern, future work)
- Supporting MathJax (KaTeX is lighter and faster)

## Decisions

### Decision 1: KaTeX over MathJax

**Choice**: KaTeX

**Rationale**: KaTeX renders synchronously and is significantly faster than MathJax. It produces identical output for the math subset used in paper QA contexts. Bundle size (~300KB with fonts) is acceptable for an internal tool. MathJax is heavier (~2MB) and uses async rendering that complicates the `computed` property pattern.

**Alternative considered**: MathJax — more complete LaTeX coverage but slower, larger, and async rendering model doesn't fit the current synchronous `marked.parse()` → `v-html` pipeline.

### Decision 2: marked-katex-extension

**Choice**: Use `marked-katex-extension` npm package to integrate KaTeX into the `marked` pipeline.

**Rationale**: This is the official community extension for marked + KaTeX. It hooks into marked's tokenizer to detect math delimiters before markdown parsing (preventing conflicts like `_` being treated as emphasis inside math). Supports all four delimiter styles out of the box: `$`, `$$`, `\(`, `\)`, `\[`, `\]`.

**Alternative considered**: Custom marked extension — more control but duplicates well-tested parsing logic. The community extension is actively maintained and handles edge cases (e.g., `$` inside code blocks, escaped delimiters).

### Decision 3: CSS fix strategy for lists

**Choice**: Add explicit `list-style-type: disc` (for `<ul>`) and `list-style-type: decimal` (for `<ol>`) in the component's scoped styles.

**Rationale**: This directly counteracts Tailwind Preflight's `list-style: none` reset. It's the minimal fix — no new dependencies, no plugin installation. The existing `padding-left: 1.5em` already provides correct indentation for the markers.

**Alternative considered**: Install `@tailwindcss/typography` and use `prose` classes — would fix lists but introduce a large set of opinionated styles that may conflict with existing custom styles. Over-engineering for a two-line CSS fix.

### Decision 4: Remove dead prose classes

**Choice**: Remove `prose prose-sm` from the template div, keep `markdown-content max-w-none`.

**Rationale**: These classes do nothing without `@tailwindcss/typography`. Removing them avoids confusion and prevents future conflicts if the plugin is ever added.

## Risks / Trade-offs

- **[Risk] KaTeX doesn't support all LaTeX commands** → Mitigation: KaTeX covers all common math notation. Unsupported commands render as red error text by default; we'll configure `throwOnError: false` to render them as raw text instead.
- **[Risk] Dollar signs in non-math contexts** (e.g., "$100") → Mitigation: `marked-katex-extension` requires no space after opening `$` and no space before closing `$`, matching standard LaTeX convention. Single `$` for currency in prose is typically followed by a number without closing `$`, so false positives are rare.
- **[Risk] Bundle size increase** → Mitigation: ~300KB is acceptable for an internal tool. KaTeX fonts are loaded on demand.
