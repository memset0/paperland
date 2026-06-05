## Why

Display (block) math formulas (`$$...$$` / `\[...\]`) render inside a full-width,
centered block. The click-to-copy hover hint (a subtle highlighted background) is
applied to the `.katex` element, which in display mode is `display: block` and
therefore spans 100% of the container width. The result: hovering a short centered
formula lights up the entire row instead of just the formula, making the
copy-affordance look wrong and over-sized. The highlight should hug the formula's
actual rendered width.

## What Changes

- Make the display-math hover/click-to-copy highlight cover **only the formula's
  actual rendered width** (the visible KaTeX box), not the full width of the
  centered block container.
- Preserve the existing behavior for genuinely **over-wide formulas**: a formula
  wider than the container still maxes out at 100% width and scrolls horizontally
  (current `overflow-x: auto` behavior is kept).
- Keep display math **centered** within its block, and keep the inline-math hover
  hint (which already hugs its content) unchanged.
- No change to what gets copied, the toast, or any other math behavior — purely the
  visual extent of the hover highlight.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `markdown-math-rendering`: the "Click math formula to copy LaTeX source" →
  "Math formula hover hint" scenario is refined so the hover background for
  **display** math covers only the formula's rendered width (not the full block
  width), while over-wide formulas still cap at 100% width with horizontal scroll.

## Impact

- **Code**: `packages/frontend/src/components/MarkdownContent.vue` — CSS only. Adjust
  the `.katex-display` / `.katex-display > .katex` rules so the inner KaTeX box
  shrink-wraps to content width (so the `.katex:hover` background fits it) while the
  block keeps centering + `overflow-x: auto` for wide formulas.
- **Docs**: `docs/frontend-architecture.md` — note the display-math hover-highlight
  width behavior if the math-rendering section mentions it.
- **No backend / API / DB / config changes.** No change to the copy handler
  (`onKatexClick`), highlight composable, or markdown pipeline.
