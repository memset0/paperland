## Context

The notes mind-map is a hand-rolled component (`packages/frontend/src/components/notes/NoteNode.vue` + `NoteMindmap.vue`) — no external mind-map library. All node sizing lives as plain CSS in `NoteNode.vue`:

- Heading / center nodes (`.nn-box`): `max-width: 240px`, `white-space: nowrap`; the title (`.nn-title`) uses `overflow: hidden; text-overflow: ellipsis`, so long headings are cut off with `…`.
- Content nodes (`.nn-content`, derived from leading blockquotes): `max-width: 260px`, `white-space: normal` (already wraps).
- A character-count badge (`.nn-count`, `flex-shrink: 0`) sits beside the title inside the `inline-flex` box.

Connectors are SVG paths recomputed by a `ResizeObserver` in `NoteMindmap.vue` whenever node geometry changes.

This change is small and frontend-only; the design doc exists mainly to record the chosen values and the decision not to add new config.

## Goals / Non-Goals

**Goals:**
- Make node cells noticeably wider.
- Show full heading text by wrapping onto multiple lines instead of ellipsis truncation.
- Keep the character-count badge beside the (possibly multi-line) heading, and keep connectors correctly anchored to taller nodes.

**Non-Goals:**
- No change to mind-map structure, drag/reparent, editing, content-node derivation, or connector logic.
- No new `config.yml` keys or frontend config plumbing.
- No auto-sizing/measuring of text; we only relax the width cap and the wrap rules.

## Decisions

**1. Increase max-width: 240px → 360px (heading/center) and 260px → 360px (content).**
~50% wider, comfortable for typical headings while not letting one node dominate the canvas. Unifying heading and content nodes at the same `360px` cap keeps wrapped headings and blockquote content visually aligned. Alternative considered: a single shared CSS custom property (`--nn-node-max-width`) referenced by both selectors — adopted, since the two values now match and a single var documents intent and eases future tuning.

**2. Wrap heading text instead of truncating.**
- `.nn-box`: `white-space: nowrap` → `white-space: normal`.
- `.nn-title`: remove `overflow: hidden; text-overflow: ellipsis`; add `overflow-wrap: anywhere` so very long unbroken tokens (e.g. URLs) still wrap inside the cell rather than overflowing the `max-width`.
- `.nn-count` keeps `flex-shrink: 0` so the badge never wraps or shrinks; it stays beside the title.
Alternative considered: `-webkit-line-clamp` (clamp to N lines, then ellipsis) — rejected, because the explicit ask is to show the **full** content, not a longer-but-still-clamped version.

**3. Badge vertical alignment stays `align-items: center`.**
With a multi-line title the count badge centers against the title block. This is acceptable and keeps the single-line case unchanged. Switching to `flex-start` was considered but offers no clear win for the common short-heading case.

**4. No connector code change.**
The existing `ResizeObserver` already recomputes connector endpoints when a node's height changes, so wrapped (taller) nodes reflow their connectors automatically. We only verify this rather than touch the logic.

**5. Sizing stays in component CSS, not `config.yml`.**
The entire mind-map's geometry (paddings, gaps, font sizes, widths) is hardcoded CSS with no frontend config pipeline. Promoting a single presentational `max-width` to `config.yml` would be inconsistent and require new plumbing for no real tuning benefit; `config.yml` is reserved for backend/service tunables.

## Risks / Trade-offs

- [Very long single-line headings now produce tall multi-line nodes, increasing vertical spacing between siblings] → Acceptable and intended; this is the requested behavior. The 360px cap bounds how many lines a given heading takes.
- [Count badge centered against a tall wrapped title may look slightly off] → Minor cosmetic; common case (short headings) is unchanged.
- [Wider nodes consume more horizontal canvas] → 360px is a modest increase; mind-map already scrolls/pans.

## Migration Plan

Pure CSS edit in one component; no data migration. Rollback = revert the CSS values. No deploy steps beyond the normal frontend build.

## Open Questions

None.
