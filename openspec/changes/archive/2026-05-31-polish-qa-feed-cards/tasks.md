## 1. Setup

- [x] 1.1 Add the shadcn `skeleton` component at `src/components/ui/skeleton/` (`Skeleton.vue` + `index.ts`). Authored manually to match repo conventions (cn + `data-slot="skeleton"`) rather than via the CLI; no spinner fallback needed.
- [x] 1.2 Confirm the needed primitives import cleanly: `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent`, `Card`/`CardHeader`/`CardContent`, `Separator`, `Tooltip`/`TooltipTrigger`/`TooltipContent`, `Checkbox`, `Label`, `Skeleton`.

## 2. Rebuild the feed card (`QAFeedPanel.vue`)

- [x] 2.1 Replace the manual `isOpen` ref + `v-if` body with `<Collapsible v-model:open>`; header is `CollapsibleTrigger as-child` on `CardHeader`, body is `CollapsibleContent`.
- [x] 2.2 Move the on-open side effect (`highlightStore.loadForPathname('/papers/:id')`) to a `watch` on the open state so it fires only when the panel expands.
- [x] 2.3 Express the card with structured shadcn `Card` parts (`CardHeader` for the trigger region, `CardContent` for the body) and add a `Separator` between header and body.
- [x] 2.4 Keep the header's three zones: status icon + animated chevron (chevron rotates on open), prompt as primary line + paper-link/timestamp meta line (`flex-1 min-w-0`, `line-clamp-1` prompt), answer-count/model `Badge` on the right.
- [x] 2.5 Wrap the status icon (done/running/failed) in a `Tooltip` whose content names the status (已完成 / 生成中 / 生成失败).
- [x] 2.6 Keep the paper `router-link`'s `@click.stop` so navigation does not toggle the panel.
- [x] 2.7 Add a subtle hover affordance on the card/trigger (`hover:shadow-sm` on the card, `hover:bg-accent/40` on the header).

## 3. Regenerate dialog model selection

- [x] 3.1 Replace the toggle-`Button` model grid in the regenerate `Dialog` with a vertical list of `Checkbox` + `Label` rows bound to `regenDialog.selectedModels`.
- [x] 3.2 Verify submit still posts every checked model name and that submit is disabled when nothing is selected (verified visually: preselected model checked, 提交 disabled when none).

## 4. Polish shared result view (`QAResultView.vue`)

- [x] 4.1 Wrap each icon-only action button (pin / copy / regenerate / delete) in `Tooltip` / `TooltipTrigger as-child` / `TooltipContent`, removing the native `title` attribute.
- [x] 4.2 Replace the `mt-3 pt-2 border-t` action-row dividers (both the multi-result and single-result branches) with `<Separator class="my-3" />`.
- [x] 4.3 Props/emits unchanged so the paper-detail page keeps working (no signature changes; same component reused).

## 5. Page shell (`QAPage.vue`)

- [x] 5.1 Add an `#actions` slot to `AppPage` containing a refresh icon `Button` (RefreshCw, wrapped in a `Tooltip`) wired to the existing `onRefresh()`, spinning while `qaStore.feedLoading`.
- [x] 5.2 Replace the bare `Loader2` loading block with 3 `Skeleton` placeholder cards (`h-[68px]`) matching the card silhouette.
- [x] 5.3 Leave the empty state and polling logic unchanged.

## 6. App-wide Tooltip provider fix (discovered during apply)

- [x] 6.1 Wrap the `<RouterView />` outlet in `App.vue` with a `<TooltipProvider>`. The existing provider only wrapped the desktop sidebar, so the new page-content `Tooltip`s (QA feed cards + the shared result view) threw "must be used within TooltipProvider" and crashed the page (also affecting the paper-detail page via `QAResultView`). This was found via a temporary preview render and is required for the change to work.

## 7. Verify & document

- [x] 7.1 Verified the cards via a temporary `/qa-preview` render (Playwright, since `/qa` is auth-gated): collapsed + expanded states render, expand/collapse animates with chevron rotation, status/action `Tooltip`s show (e.g. "删除"), single- and multi-result bodies render with `Separator` dividers, and the regenerate dialog shows `Checkbox` + `Label` rows. Temporary preview route/component removed afterward.
- [x] 7.2 Type-check the frontend (`vue-tsc --noEmit`) — clean (exit 0); `vite build` — clean.
- [x] 7.3 Update `docs/frontend-architecture.md` with the QA feed page / card shadcn-composition notes and the App-wide TooltipProvider note.
- [x] 7.4 Fold the post-apply App.vue TooltipProvider fix back into this change's `proposal.md`, `design.md`, and delta spec before archiving.

## 8. Performance: feed pagination + single model fetch (post-apply, after lag report)

- [x] 8.1 Backend `GET /api/qa/free` (`packages/backend/src/api/qa.ts`): read `page`/`page_size` (default 20), slice the user's entries, and return `{ data, pagination: { page, page_size, total, total_pages } }`. Verified slice logic directly against the DB (217 free entries → 11 pages: 20×10 + 17).
- [x] 8.2 Store (`stores/qa.ts`): add `feedPagination` state; make `fetchFeed(showLoading, page)` page-aware (`/api/qa/free?page=&page_size=`) and store the returned `pagination`; polling re-fetches the current page.
- [x] 8.3 Store: add shared `availableModels` + cached `fetchModels()` (single request); export both.
- [x] 8.4 `QAFeedPanel.vue`: drop the per-card `onMounted` `/api/config/models` request; read models via `computed(() => store.availableModels)` (dialog + template references unchanged).
- [x] 8.5 `QAPage.vue`: call `fetchModels()` once on mount; add prev/next pagination controls (mirroring `PaperList`) shown when `total_pages > 1`; scroll the list to top on page change.
- [x] 8.6 Restart the backend from project root so the API change takes effect; confirmed `/api/health` 200, new PID on :3000, and no stray `packages/backend/data`. Frontend picks up changes via Vite HMR.
- [x] 8.7 Type-check (`vue-tsc` clean) + backend `bun build` clean. Fold this perf pass into `proposal.md`, `design.md` (Decision 9), the delta spec (paginated list + API-endpoint + current-page polling + single-models-fetch), and `docs/frontend-architecture.md`.

## 9. Skeleton polish (post-apply, after "blue boxes / clipped top border" report)

- [x] 9.1 Change the `Skeleton` default background from `bg-accent` (this theme customizes `--accent` to blue) to neutral, light/dark-adaptive `bg-foreground/10`.
- [x] 9.2 Replace `QAPage`'s 3 solid `h-[68px]` loading blocks with structured skeleton cards — real card silhouette (`ring-1 ring-foreground/10 rounded-lg`) + `Skeleton` blocks for status dot / chevron / title line / sub-title line / badge. Count = `feedPagination.page_size` (one page's worth), not a hard-coded number, so the list height matches before/after load.
- [x] 9.3 Add `pt-2` to the loading and list scroll containers so `overflow-y-auto` no longer clips the top card's `ring` border.
- [x] 9.4 Verified via a temporary `/qa-preview` Playwright screenshot: skeletons render neutral-grey + structured, top card border intact. Temp route/component removed; `vue-tsc` shows no errors in touched files (remaining errors are a concurrent agent's notes WIP). Fold into `design.md` (Decision 6) + `docs`.

## 10. Card header layout iteration (post-apply, per user feedback)

- [x] 10.1 Bold the question (`font-medium` → `font-semibold`, matching the detail-page question style).
- [x] 10.2 Move paper title + time OUT of the card onto a line ABOVE it (paper link left; time right-aligned via `ml-auto` — "right-aligned" per the user's "右上角=右对齐"); keep the card header one simple row.
- [x] 10.3 Let the paper title use the full line width (drop `max-w-[200px]` truncation) so long titles show.
- [x] 10.4 Remove the expand/collapse chevron (whole header stays clickable to toggle); drop the now-unused `ChevronRight` import.
- [x] 10.5 Wrap the component in a single root `<div>` (paper line + card + dialog) so the list `space-y-3` separates by entry; the paper link, now outside the card, no longer needs `@click.stop`. (This also resolved a stray width issue the interim in-card `flex-col` header had.)
- [x] 10.6 Match the loading skeleton to the new structure (above-card paper/time line + simple card row). Verified via temporary `/qa-preview` screenshot; temp route/component removed; `vue-tsc` clean for touched files. Folded into the delta spec ("QA feed panel structure"), `design.md`, and `docs`.
