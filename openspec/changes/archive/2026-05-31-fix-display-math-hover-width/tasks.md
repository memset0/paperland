## 1. Shrink-wrap the display-math hover box

- [x] 1.1 In `packages/frontend/src/components/MarkdownContent.vue` (KaTeX display CSS, ≈ lines 532–539), override `.katex-display > .katex` to `display: inline-block` (+ `flex-shrink: 0`) so the inner KaTeX box hugs the formula's content width (the `.katex:hover` background then fits the formula instead of the full row).
- [x] 1.2 Keep `.katex-display` centered and scrollable: retained `overflow-x: auto; overflow-y: hidden;` and centered via `display: flex; justify-content: safe center;` (with a plain `justify-content: center` fallback line) per design Decision 2. Left inline `.katex` and the `.katex:hover` background rule unchanged.

## 2. Verify behavior in the running app

- [x] 2.1 Short display formula (`$$E=mc^2$$`): verified by CSS construction — the `.katex` flex child (`flex-shrink:0`) sizes to its content width (no longer `display:block`=100%), `safe center` centers it, and the `.katex:hover` background sits on that content-width box → highlight hugs the formula. (No headless browser in this env for a live hover screenshot; recommend a quick in-app eyeball.)
- [x] 2.2 Over-wide display formula: verified by CSS construction — `flex-shrink:0` keeps the formula at content width (not squished), `overflow-x:auto` provides horizontal scroll, and `safe center` falls back to flex-start so the left edge stays reachable.
- [x] 2.3 Inline math + click-to-copy: the inline `.katex` / `.katex:hover` rules and `onKatexClick` were untouched; the override is scoped to `.katex-display > .katex` (display only), so inline hover hint and LaTeX-copy + toast are unchanged. `vite build` of the frontend passed (no SFC/CSS breakage).

## 3. Docs & spec sync

- [x] 3.1 Updated `docs/frontend-architecture.md` 数学公式「样式」节: the display-math hover highlight hugs the formula's actual width (no longer the full row) and over-wide formulas cap at 100% width with horizontal scroll, documenting the `flex` + `safe center` + `inline-block; flex-shrink:0` mechanism.
- [x] 3.2 Re-read proposal/design/specs against the implementation; folded the chosen centering technique back into design.md (Decision 2 now states the flex `safe center` + `flex-shrink:0` end-state as adopted; Open Questions / Risks updated to note verification was by CSS construction + `vite build` rather than a live hover screenshot).
