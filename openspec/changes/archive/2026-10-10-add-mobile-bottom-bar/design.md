## Context

Both pages already switch layouts at 900px (`isWide` in `PaperDetail`, `min-[900px]` grid in `ResearchDetail`); the app shell switches at 768px (top navbar + drawer below md). In the narrow PaperDetail layout the viewer (`PaperViewerPanel`) is not rendered at all.

## Decisions

1. **One component, opt-in per page.** `components/MobileBottomBar.vue` takes `items: { key, label, icon, kind: 'section' | 'action', badge?, busy? }[]` and `v-model` (active section key), emits `action(key)`. It renders `position: fixed; bottom: 0` with `padding-bottom: env(safe-area-inset-bottom)`, inside a `<Transition>` (enter: translate-y-full + opacity-0 → none, ~250ms ease-out; appear on mount). Pages render it only when `useNarrowLayout()` (shared `matchMedia('(max-width: 899px)')` ref) is true and not embed — no global state, so it cannot appear on other pages.
2. **Reserved space.** The bar height is a CSS variable `--bottom-bar-h` (56px + safe area); pages add `pb-[var(--bottom-bar-h)]` to their scroll containers / root so nothing is covered. The QA floating window is full screen on phones and sits above the bar (z-index), which is fine.
3. **PaperDetail sections** use `v-show` (not `v-if`) so each keeps its scroll position and component state (PDF viewer stays loaded). Read renders `PaperViewerPanel` in a `flex-1` area (header above, bar below). Section switching for deep links reuses existing signals: `requestedPdfTarget` / `requestedPublicNote` / `route.query.view === 'note'` → Read; `paperInfoRequests` (fired by `revealQAEntry` / `locateBlock`) → Q&A. The `?h=` locate of a non-QA block (abstract, notes) still works because `locateBlock` searches visible elements first: when the target is not visible we switch to Q&A, which is where answer blocks live.
4. **Launcher.** `PaperActionLauncher` is not rendered in the header when the bar is shown; its actions (`paperActions`) become bar action items. The FAB code path stays only for an eventual narrow page without a bar (none today) — removed to keep it simple: the launcher renders desktop buttons only.
5. **ResearchDetail.** Wide: left column order becomes input block → steps reversed (`[...steps].reverse()`). Narrow: sections Instruct / Report / Papers with `v-show`; the inner Report/Papers `Tabs` are hidden and driven by the bar (`versionTab` = active section when it is report/papers). Instruct renders steps oldest → newest in a scroll area and the input block `fixed` above the bar (`bottom: var(--bottom-bar-h)`), with the scroll area padded by the input's measured height (ResizeObserver); entering Instruct scrolls to the end. The Instruct item shows a spinner while a round is active and a badge with the queued count.
6. **Initial sections.** Paper: Info (what the narrow page showed first before). Research: Report (the version view came first on narrow screens before).

## Risks / Trade-offs

- iOS virtual keyboard: the fixed input moves with the visual viewport on modern iOS Safari; acceptable.
- The PDF viewer on phones is heavier; it only mounts when Read is first opened (lazy `v-if` once, then `v-show`).
