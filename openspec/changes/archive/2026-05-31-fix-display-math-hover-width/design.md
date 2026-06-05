## Context

Display math is rendered by `@traptitech/markdown-it-katex` as:

```html
<span class="katex-display">
  <span class="katex"> … rendered formula … </span>
</span>
```

KaTeX's own stylesheet sets `.katex-display > .katex { display: block; … }`, so the
inner `.katex` box stretches to the **full width** of the `.katex-display` block.

The current overrides in `MarkdownContent.vue` (≈ lines 532–539):

```css
.markdown-content :deep(.katex-display) {
  text-align: center; margin: 0.5em 0; overflow-x: auto; overflow-y: hidden;
}
.markdown-content :deep(.katex-display > .katex) { text-align: center; }
/* click-to-copy cursor & hover (applies to BOTH inline and display .katex) */
.markdown-content :deep(.katex) { cursor: pointer; border-radius: 6px; transition: background-color 0.15s; padding: 1px 3px; }
.markdown-content :deep(.katex:hover) { background-color: color-mix(in oklch, var(--primary) 12%, transparent); }
```

Because the hover background lives on `.katex` and the display-mode `.katex` is a
full-width block, hovering a short centered formula highlights the entire row. For
**inline** math `.katex` is `display: inline-block`, so its hover hint already hugs
its content — only display math is wrong.

`overflow-x: auto` on `.katex-display` gives the desired horizontal-scroll behavior
for formulas wider than the container, and that must be preserved.

## Goals / Non-Goals

**Goals:**
- Display-math hover/click highlight covers only the formula's actual rendered width.
- Over-wide formulas still cap at 100% width and scroll horizontally (unchanged).
- Display math stays horizontally centered; inline math hover hint unchanged.

**Non-Goals:**
- No change to the copy handler (`onKatexClick`), the toast, or what LaTeX is copied.
- No change to the highlight composable (`useHighlight`) or KaTeX-as-atomic-unit logic.
- No markdown-pipeline / plugin changes. CSS-only.

## Decisions

### Decision 1: Shrink-wrap the inner `.katex` box instead of moving the hover target

Change `.katex-display > .katex` from the inherited `display: block` to
`display: inline-block`. An inline-block shrink-wraps to its content width, so the
`.katex:hover` background (which already targets `.katex`) now hugs the formula —
no separate hover-target element or extra wrapper needed.

- **Alternative considered — move the hover background onto an inner KaTeX span**
  (e.g. `.katex-display .katex-html`): brittle, couples our CSS to KaTeX's internal
  DOM, and risks breaking the `useHighlight` logic that treats `.katex`/`.katex-display`
  as the atomic unit. Rejected.
- **Alternative considered — wrap `.katex` in a new inline-block element in JS**:
  unnecessary DOM/JS churn for what a one-line CSS change achieves. Rejected.

### Decision 2: Center with flex `safe center`, with `flex-shrink: 0` for the overflow case

`text-align: center` would also center an inline-block child, but it has a catch:
when an inline-block child is **wider** than an `overflow-x: auto` container,
`text-align: center` pushes the left edge out of reach (the browser centers the
overflow, clipping the start of the formula and making it unscrollable on the left).

To keep the existing "wide formula scrolls and you can reach both ends" behavior,
the **flex `safe center`** form below was adopted directly (the robust end-state),
rather than starting from plain `text-align: center` and conditionally upgrading:

```css
.markdown-content :deep(.katex-display) {
  display: flex;
  justify-content: center;        /* fallback for browsers without `safe` */
  justify-content: safe center;   /* `safe` falls back to flex-start when overflowing */
  margin: 0.5em 0; overflow-x: auto; overflow-y: hidden;
}
.markdown-content :deep(.katex-display > .katex) {
  display: inline-block; flex-shrink: 0; text-align: center;
}
```

`justify-content: safe center` centers when the formula fits and falls back to
flex-start (left, fully scrollable) when it overflows — solving the clipping bug
that plain `text-align: center` and plain `justify-content: center` both have.
`flex-shrink: 0` on the child is essential: without it a flex item wider than the
container would be **compressed** to fit instead of overflowing into the scroll. A
plain `justify-content: center` fallback line precedes the `safe center` line so
browsers that don't parse the `safe` keyword still center (losing only the
left-edge-reachability nicety on over-wide formulas).

- **Alternative considered — `text-align: center` only**: simplest, but exposes the
  left-clipping bug for very wide formulas, which would regress the scroll behavior
  the user explicitly wants kept. Rejected in favor of the flex form above.

## Risks / Trade-offs

- **[Wide-formula left-clipping]** → Addressed by adopting `justify-content: safe
  center` + `flex-shrink: 0` (Decision 2), which keeps the left edge reachable on
  overflow without relying on the clip-prone `text-align: center`.
- **[KaTeX upgrade could reintroduce `display: block`]** → Our `:deep` override has
  higher specificity / later cascade than the bundled KaTeX rule; an upgrade would
  not silently undo it. Low risk.
- **[Vertical alignment shift]** → In a flex container the inline-block child is a
  flex item, so the inline-block baseline-whitespace gap does not apply;
  `.katex-display` keeps its own `margin: 0.5em 0`. No spacing change expected.

## Open Questions

- Resolved: the flex `safe center` + `flex-shrink: 0` form was adopted as the
  implementation (see Decision 2). The apply step verified correctness by CSS
  construction and a successful `vite build`; no headless browser was available in
  the apply environment for a live hover screenshot, so a quick in-app eyeball is
  recommended as a final visual confirmation.
