## Context

Notes are rendered by `MarkdownContent.vue`, which configures a singleton `markdown-it` instance (`md.render(content)` → `el.innerHTML`) and then does a **post-render DOM walk** to apply highlights (`renderAndHighlight()`). Images use one global CSS rule:

```css
.markdown-content :deep(img) { max-width: 100%; height: auto; border-radius: 0.375rem; margin: 0.5em 0; }
```

There is no custom `markdown-it` image rule and no alt-text parsing today. A related convention already exists: PDF-region screenshots are embedded as `[![](url)](paperland://…rx…)`, so authors are already used to encoding metadata around images. The new directive lives in the image **alt text** (the `![…]` part).

The same `MarkdownContent` component is reused by the mindmap (`NoteNode.vue` content nodes), which wraps it in a `max-width: 260px` container and renders at `font-size: 12px`. The user wants the width directive to apply to direct note rendering **only**, and to leave mindmap image sizing as-is for now.

Precedent for configurable frontend render constants: `screenshot_dpi` is defined in `config.yml` and fetched by the frontend via `configApi.pdf()` (`/api/config/pdf`). The repo convention (and user preference) is that tunable values belong in `config.yml`, not hardcoded.

## Goals / Non-Goals

**Goals:**
- Let a note author cap an individual image's rendered width from within plain markdown, using `w=sm|md|lg` (preset tiers) or `w=<px>` (explicit pixel cap) in the image alt text.
- Keep the default (no directive) behavior identical to today: `width: 100%` of the column, capped only by the container.
- Treat the directive strictly as a `max-width` cap so an image never overflows its container, even when the tier/number exceeds the column width.
- Make the three tier values tunable via `config.yml`.
- Leave mindmap image sizing unchanged.

**Non-Goals:**
- No mindmap-aware sizing (explicitly deferred — the directive is ignored in mindmap nodes).
- No new editor UI / toolbar to insert the directive (authors type it in markdown, as with the existing `paperland://` anchor convention).
- No support for height control, alignment, captions, or percentage widths (`w=50%`) in this change — only `sm|md|lg` and integer-pixel `max-width`.
- No change to how images are uploaded or stored (`image_host` is untouched).

## Decisions

### Decision 1 — Directive grammar: `w=sm|md|lg|<integer>` in the alt text

The directive is a single token of the form `w=<value>` located anywhere in the image alt text (whitespace/word-boundary delimited), where `<value>` is one of `sm`, `md`, `lg` (case-insensitive), or a positive integer (pixels).

- Parse the **first** valid `w=` token; ignore any additional ones.
- After parsing, **strip the token** from the alt text so it isn't shown as alt/caption.
- An invalid or absent directive → default rendering (no cap beyond `max-width: 100%`).
- Alt text may contain other words alongside the directive, e.g. `![figure 1 w=md](url)` → alt becomes `figure 1`, width capped at the `md` tier.

This works uniformly for bare images `![w=md](url)` and anchor-wrapped PDF screenshots `[![w=lg](url)](paperland://…)`, because in both cases the rendered `<img>` carries the alt attribute.

*Alternatives considered:* (a) a custom `markdown-it` image renderer rule — rejected because the existing pipeline already does a post-render DOM walk for highlights, so hooking there is consistent and avoids fighting markdown-it's token escaping; (b) encoding width in the `src` query string — rejected because it would pollute the image URL / image-host cache key and break the "metadata in alt" mental model.

### Decision 2 — The three tiers: sm=240, md=480, lg=720 (px)

Designed values, chosen to be evenly spaced, memorable (240 / 480 / 720 = 1× / 2× / 3× of 240), and to map onto the common note image use-cases:

| Tier | `max-width` | Intended use |
|------|-------------|--------------|
| `sm` | **240px** | Small inline crop — a single equation, an icon, a tiny snippet. Roughly thumbnail size; sits comfortably beside text. |
| `md` | **480px** | A normal figure / a PDF-region screenshot of a chart or table. Half-ish of a typical reading column. |
| `lg` | **720px** | A large figure meant to be read in detail. ≈ a comfortable full reading-column measure; still capped by the container so it never overflows. |

`w=<number>` sets an explicit pixel `max-width` for cases that don't fit a tier; it is clamped to a sane range (`[16, 4096]` px) and otherwise ignored if non-positive/non-integer.

*Rationale:* `lg` ≈ 720px matches a classic readable column width, so "large" reads as "as big as it's worth making it" without blowing past the text measure; `sm`/`md` give clear, distinct steps below that. Values are starting points and are tunable in `config.yml`.

### Decision 3 — `max-width` is an additional cap, combined with the container via `min()`

The directive never replaces the existing `width: 100%` behavior; it only adds an upper bound. Implementation uses CSS `min()` so the image is at most the tier width **and** at most the container width:

- Tiers → a CSS class per tier whose rule is `max-width: min(var(--note-img-w-<tier>, <default>), 100%)`.
- Numeric → inline `style="max-width: min(<n>px, 100%)"`.

Because `min(<tier>, 100%)` is always ≤ `100%`, an image in a narrow container (or the 260px mindmap node, if the directive were ever applied there) can never overflow. `height: auto` is preserved so aspect ratio is maintained.

### Decision 4 — Tier values in `config.yml`, applied as CSS custom properties with CSS fallbacks

Add a `notes.image_width_tiers` block to `config.yml` (`sm` / `md` / `lg` integer px), validated in `packages/backend/src/config.ts` with **explicit** Zod defaults (`.default({ sm: 240, md: 480, lg: 720 })` — not `.default({})`, per the known nested-default gotcha). Expose the values to the frontend through the existing config-API pattern (extend the `configApi.pdf()`-style endpoint), and on app bootstrap set CSS custom properties `--note-img-w-sm/md/lg` on `:root`.

The tier CSS classes reference these variables **with the designed defaults baked in as fallbacks** — `max-width: min(var(--note-img-w-md, 480px), 100%)`. This means: rendering is correct even before (or without) the config fetch, the values are tunable from one place, and there is no flash-of-wrong-size. Numeric `w=<px>` does not depend on config.

*Alternatives considered:* hardcoding the three values as pure frontend CSS tokens — simpler, but rejected to stay consistent with the `screenshot_dpi` precedent and the "tunable values live in `config.yml`" convention. The CSS-fallback approach keeps the frontend robust if the fetch is skipped (e.g. anonymous/public-note contexts), so we get configurability without a hard runtime dependency.

### Decision 5 — Disable the directive in mindmap rendering via a prop

`MarkdownContent` gains a boolean prop `applyImageWidth` (default = `true`, i.e. directive enabled) that, when explicitly `false`, skips applying the width cap. `NoteNode.vue` passes `:apply-image-width="false"` for content nodes so mindmap image sizing is governed solely by the existing node layout. The directive **token is still stripped** from alt in both modes (so the raw `w=md` text never leaks into a node), but the `max-width` cap is only applied in direct rendering.

**Gotcha (must use `withDefaults`):** a Boolean-typed Vue prop that the parent omits is cast to `false`, not `undefined`. So `applyImageWidth` MUST be defaulted to `true` via `withDefaults(defineProps<…>(), { applyImageWidth: true })`. Without it, every default usage (walkthrough, paper notes card, public notes, FAQ — none of which pass the prop) gets `false` and the directive is silently disabled everywhere except where it's explicitly enabled — i.e. the feature renders nowhere. The gate is `if (!props.applyImageWidth) continue` (only `NoteNode` passes `false`).

## Risks / Trade-offs

- **Directive collides with legitimate alt text containing `w=...`** → Mitigation: require the exact pattern `w=(sm|md|lg|\d+)` at a word boundary and only consume that token; surrounding alt text is preserved. Realistic alt text rarely contains a bare `w=<number/sm/md/lg>` token.
- **Author sets a huge `w=<px>`** → Mitigation: clamp numeric values to `[16, 4096]`; `min(…, 100%)` still prevents overflow regardless.
- **HTML→Markdown round-trip (turndown "copy as anchor") loses the directive** → The note's markdown source (editor) is the source of truth, not the rendered DOM; stripping the directive from the rendered `alt` is display-only and does not rewrite the stored note. `selectionToMarkdown` is used for copying anchors, not for persisting notes, so this is acceptable. Documented as a known limitation.
- **Config fetch unavailable in public/anonymous note views** → Mitigation: CSS fallbacks equal the designed defaults, so tiers render correctly even when the config endpoint isn't fetched.
- **A tier ≥ the column width produces no visible cap** → Because the cap is `min(tier, 100%)`, when the tier is at least as wide as the rendering column the image still fills the column (this is intentional — it must never overflow). In the paper-detail **walk-through**, which renders in a ~45% split panel (~450–550px content area), this means `w=md` (480px) only visibly constrains on wide screens and `w=lg` (720px) almost never does there; `w=sm` (240px) is the reliable "make it small" tier in that narrow context. Verified empirically (rendered image width at column widths 440/500/560/640/820 → `w=md` = 440/480/480/480/480). The default tiers (240/480/720) are kept as-is — they target wider note contexts (full-width notes page / wide screens); the narrow-panel behavior is expected, not a defect.

## Migration Plan

No data migration. Purely additive and opt-in per image. Rollback is removing the parsing/CSS (existing notes render identically because untagged images are unaffected). New `config.yml` block has defaults, so existing deployments need no config edit.

## Open Questions

- Should `w=<number>%` (explicit percentage) be supported later? Out of scope now; the grammar leaves room (`w=` prefix) to add it without conflict.
- Future: a mindmap-aware sizing mode (the user noted the directive "may later affect the mindmap"). Deferred; the `MarkdownContent` prop added here is the seam where that behavior would be enabled.
