## Context

The `/qa` page (`QAPage.vue`) renders every free-QA entry as a `QAFeedPanel.vue` card and reuses `QAResultView.vue` for the expanded body. shadcn-vue is already configured (`components.json`, `src/components/ui/`) and the relevant primitives are **already installed**: `card` (with `CardHeader`/`CardContent`/`CardFooter`/`CardTitle`/`CardDescription`/`CardAction`), `collapsible`, `tooltip`, `separator`, `checkbox`, `label`, `badge`, `button`, `dialog`, `tabs`. A `TooltipProvider` is already mounted app-wide in `App.vue`, so `Tooltip`/`TooltipTrigger`/`TooltipContent` can be used directly. The only primitive not yet present is `skeleton`.

Today the card is hand-assembled: collapse is a manual `isOpen` ref + `v-if`, the header is one full-width ghost `Button`, dividers are `border-t`, and icon actions use the native `title` attribute. This is a pure presentation/composition refactor — no data, endpoint, or action-behavior changes.

## Goals / Non-Goals

**Goals:**
- Each feed card reads as a first-class shadcn surface: built from `Collapsible` + structured `Card` parts, with `Separator` dividers and `Tooltip`-annotated icon actions.
- Preserve every existing behavior exactly: expand/collapse, polling, regenerate (with model multi-select), delete, copy, pin, paper link navigation, status display, default-collapsed.
- Polish the page shell: a refresh affordance in the `AppPage` `#actions` slot and `Skeleton` loading placeholders instead of a bare spinner.
- Keep `QAResultView.vue` shared — its tooltip/separator polish improves the paper-detail page too, without changing its props or emits.

**Non-Goals:**
- No new feed features beyond pagination (no search, filter, sort, bulk actions). *(Pagination was added mid-change after a lag report — see Decision 9.)*
- No DB/schema changes; the only API change is backward-compatible pagination on `/api/qa/free`.
- No change to QA generation logic, polling cadence (stays 3s), or auth behavior.
- No redesign of `QAResultView`'s tab model or markdown rendering — only the action row chrome.

## Decisions

### 1. `Collapsible` replaces manual `isOpen` + `v-if`
Use `<Collapsible v-model:open>` wrapping the `Card`, with the header as `CollapsibleTrigger` and the body as `CollapsibleContent`. The chevron rotates via `data-[state=open]` / a bound class. **Why:** removes bespoke toggle state, gives built-in ARIA + animation, and matches the idiomatic shadcn collapsible-card pattern. The existing side effect on open (`highlightStore.loadForPathname(...)`) moves to a `watch` on the open state so it still fires only on expand. *Alternative considered:* keep `isOpen` and just restyle — rejected because the user explicitly wants shadcn primitives, and `Collapsible` is the right one.

### 2. Header rebuilt as `CardHeader` content, trigger keeps button semantics
The header becomes the `CollapsibleTrigger` (rendered `as-child` around a clickable header region) laid out with the same three zones: status icon + chevron (left), prompt + paper-link/timestamp meta (center, `flex-1 min-w-0`), answer-count/model `Badge` (right). The paper `router-link` keeps `@click.stop` so navigating doesn't toggle the panel. **Why:** preserves the current information architecture while swapping the chrome to shadcn structure. *Alternative:* full-width ghost `Button` as today — kept conceptually (trigger is still keyboard-focusable/clickable) but expressed through `CollapsibleTrigger` for correct semantics.

### 3. Status indicator gains a `Tooltip`
The done/running/failed icon is wrapped in a `Tooltip` whose content names the status (e.g. "已完成 / 生成中 / 生成失败"). **Why:** the icon alone is ambiguous; a tooltip is the lightweight shadcn way to label it without adding visual clutter.

### 4. `QAResultView` icon actions → `Tooltip`, dividers → `Separator`
Wrap each icon-only `Button` (pin/copy/regenerate/delete) in `Tooltip`/`TooltipTrigger as-child`/`TooltipContent`, dropping the native `title`. Replace the `mt-3 pt-2 border-t` action-row divider with `<Separator class="my-3" />`. **Why:** consistent, accessible affordances; this is the component the proposal calls out as "reused by the card," and the change is prop-compatible so the paper-detail page inherits the polish for free.

### 5. Regenerate dialog model select → `Checkbox` + `Label`
Replace the toggle-`Button` grid with a vertical list of `Checkbox` + `Label` rows bound to `regenDialog.selectedModels`. **Why:** multi-select is clearer with checkboxes; the toggle-buttons read like single-select. Behavior (submit posts the selected model names) is unchanged.

### 6. `Skeleton` loading state (new install)
Add the `skeleton` shadcn component (authored manually to match repo conventions) and render placeholder cards while `qaStore.feedLoading`. **Why:** skeletons read as polished loading affordances and reuse the same card silhouette.

*Refined after review (the placeholders looked "off"):*
- **Structure, not a slab.** The initial "3 solid `h-[68px]` blocks" looked like colored bars, not a skeleton. Each placeholder is now a card built from the **same `ring-1 ring-foreground/10 rounded-lg` silhouette** as a real collapsed card, containing `Skeleton` blocks for the status dot, chevron, a title line, a sub-title line, and a badge — so loading→content swaps without a layout jump.
- **Neutral color.** shadcn's stock `Skeleton` uses `bg-accent`, but this project customizes `--accent` to **blue** (same hue as `--primary`), so the blocks rendered as blue boxes. Changed the `Skeleton` default to `bg-foreground/10` — a neutral, light/dark-adaptive grey. (Only `QAPage` uses `Skeleton` today, so changing the default is safe and prevents the same surprise elsewhere.)
- **Container top padding.** The scroll containers (loading + list) need `pt` (e.g. `pt-2`); with only `pb-6`, `overflow-y-auto` clipped the top card's `ring` border.

### 7. Page header refresh action
Add a `#actions` slot in `QAPage.vue`'s `AppPage` with an icon `Button` (RefreshCw) wired to the existing `onRefresh()`, with a spinning state while `feedLoading`. **Why:** the page currently has no manual refresh; this is a small, expected affordance and uses the already-supported `AppPage` actions slot.

### 8. Wrap `<RouterView />` in a `TooltipProvider` (discovered during apply)
`App.vue` mounted a single `TooltipProvider` that wrapped only the desktop sidebar. Before this change, no route component used a shadcn `Tooltip` (all tooltips lived in the sidebar chrome), so this went unnoticed. Introducing tooltips into page content (feed cards + the shared `QAResultView`) surfaced a runtime crash: `Injection Symbol(TooltipProviderContext) not found. Component must be used within TooltipProvider`. **Fix:** add a second `<TooltipProvider :delay-duration="100">` around `<RouterView />` in `App.vue`'s `<main>`, leaving the sidebar's provider untouched (minimal, additive — `App.vue` is a concurrently-edited file). **Why a second provider rather than hoisting one to the root:** the sidebar provider is left intact to keep the diff small and avoid disturbing other agents' in-flight edits; nested/sibling reka `TooltipProvider`s are valid. This also fixes the paper-detail page, which reuses `QAResultView`.

### 9. Server-side pagination + single model-list fetch (added after the lag report)
Testing on a real account surfaced **~217 free-QA entries rendered at once**, making /qa severely laggy. Two compounding causes: (a) every `QAFeedPanel` fetched `/api/config/models` on mount → ~217 duplicate requests saturating the browser's ~6-connection-per-origin limit; (b) 217 cards' worth of Collapsible/Tooltip instances plus a full-array re-render on every 3s poll. (Ruled out: collapsed bodies do **not** render — reka `Collapsible` defaults `unmountOnHide: true`, so the answer markdown is not the culprit.)
**Fix:**
- **Pagination** mirrors `/api/papers`: `GET /api/qa/free` reads `page`/`page_size` (default 20), slices the user's entries (length → `total`), and returns `{ data, pagination }` (reusing `PaginatedResponse<T>`). The store holds `feedPagination`; `fetchFeed(showLoading, page)` is page-aware; `QAPage` adds prev/next controls (same markup as `PaperList`) and scrolls the list to top on navigation. Polling re-fetches the current page. Caps on-screen cards at 20.
- **Single models fetch**: move `/api/config/models` into a store-cached `fetchModels()` called once by `QAPage`; `QAFeedPanel` reads `store.availableModels` via a `computed`. N requests → 1.
**Why server-side over client-side slicing:** matches the paper list exactly (consistent UX + code) and avoids transferring all 217 entries (with full answer text) on every load as the data grows. **Why fold this perf pass into this change rather than a new one:** same capability (`qa-feed-page`), same files, not yet archived — keeping it together keeps the spec coherent. *Alternative considered — client-side slicing:* smaller diff, but still fetches everything up front and diverges from the paper-list pattern; rejected per the user's "like the paper list" request.

### 10. Card header layout, iterated on feedback
The first cut put status + chevron + question on one row with paper/time as a sub-line **inside** the card header. On feedback the layout became: **bold** question, paper title + time moved to a line **above** the card, the title using full width (no `max-w` truncation), time **right-aligned** (`ml-auto`), and **no chevron**. Final per-`QAFeedPanel` shape: an above-card line (`router-link` title + right-aligned time) then a simple one-row card header (status `Tooltip` + `font-semibold` question + answer/model `Badge`). The component root is a single `<div>` (line + card + dialog) so the list's `space-y-3` separates by entry. **Why move the title out of the card:** keeps the card's internal hierarchy minimal and lets the title span full width; the link, now outside the trigger, no longer needs `@click.stop`. An interim attempt keeping everything inside a `flex-col` `CardHeader` was dropped — content didn't stretch to full width and read as cramped.

## Risks / Trade-offs

- **`CollapsibleTrigger` wrapping interactive children (the paper link)** → The trigger contains a `router-link`; nested interactive elements can produce invalid markup/double-activation. Mitigation: keep the link's `@click.stop` and render the trigger `as-child` on a non-button element (e.g. a `div`/header with `role`), or keep the link visually inside but outside the strict trigger button. Verify clicking the link navigates without toggling.
- **`skeleton` install touches generated UI files** → Adds `src/components/ui/skeleton/`. Mitigation: it's an isolated, standard shadcn file; commit only that path. If install fails, fall back to the spinner (decision #6) — no other code depends on it.
- **Shared `QAResultView` change affects paper detail page** → Visual-only (tooltips/separator), props/emits unchanged. Mitigation: sanity-check the paper-detail QA area after the change.
- **Tooltip noise on a dense action row** → Four adjacent tooltips could feel busy. Mitigation: rely on the app-wide `TooltipProvider` delay (already `100ms`) so they only show on deliberate hover.

## Open Questions

- None blocking. Skeleton install is the only environment-dependent step and has a clean fallback.
