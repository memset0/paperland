## Why

The `/qa` summary page lists every free-QA entry as a collapsible card, but those cards are hand-assembled: the collapse is a manual `isOpen` ref + `v-if`, the header is a full-width ghost `Button`, dividers are raw `border-t`, and icon actions rely on the native `title` attribute. The result looks ad-hoc next to the rest of the app and under-uses the shadcn-vue library that is already installed. We want each card to read as a first-class shadcn surface so the page feels polished and consistent.

## What Changes

- Rebuild the QA feed card (`QAFeedPanel.vue`) on shadcn-vue primitives: `Collapsible` for expand/collapse (animated chevron, no manual `isOpen`/`v-if`), structured `Card` parts (`CardHeader` / `CardContent`), and `Separator` between header and body.
- Refine the card header chrome: status shown as a `Tooltip`-annotated indicator, prompt as the primary line, paper link + timestamp as a muted meta line, and answer-count / model shown via `Badge`. Add a subtle hover affordance.
- Give icon-only actions (pin / copy / regenerate / delete in `QAResultView.vue`, reused by the card) proper shadcn `Tooltip` labels instead of native `title`, and replace its `border-t` dividers with `Separator`. This shared component also improves the paper-detail page.
- Make the regenerate dialog's model multi-select clearer using shadcn `Checkbox` + `Label` rows.
- Polish the page shell (`QAPage.vue`): add a refresh action in the `AppPage` `#actions` slot and replace the bare spinner with shadcn `Skeleton` placeholder cards while loading.
- Wrap the `<RouterView />` outlet in `App.vue` with a `<TooltipProvider>`. Required enabling change: the existing provider only wrapped the desktop sidebar, so the newly-introduced page-content `Tooltip`s (in the feed cards and the shared result view) would otherwise throw "must be used within TooltipProvider" and crash the page (and the paper-detail page via `QAResultView`).
- **Performance — paginate the feed.** A user with 200+ free-QA entries had all of them rendered at once, making the page severely laggy. Add server-side pagination to `GET /api/qa/free` (`page` / `page_size` query params, default 20, returning a `{ data, pagination }` envelope) and previous/next controls in `QAPage.vue` mirroring the paper list. Polling re-fetches only the current page.
- **Performance — fetch the model list once.** Each `QAFeedPanel` requested `/api/config/models` on mount — one duplicate request per card (200+ requests on a large feed, the main cause of the lag). Hoist it to a single store-cached fetch at the page level, shared by all cards.
- Aside from the new (backward-compatible) pagination on `/api/qa/free`, no behavioral changes: same entries, same actions; the rest is presentation and component composition.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `qa-feed-page`: the feed panel structure requirement is tightened to mandate shadcn-vue composition (Card + Collapsible); the page list requirement gains a skeleton loading state, a header refresh affordance, and **pagination** (page through entries instead of rendering all at once); the API-endpoint requirement gains `page`/`page_size` params and a `{ data, pagination }` envelope; the polling requirement is scoped to the current page; and new requirements specify tooltip-annotated icon actions + Separator dividers and a single page-level model-list fetch.

## Impact

- **Frontend components**: `packages/frontend/src/components/QAFeedPanel.vue` (rebuilt; models from store), `packages/frontend/src/components/QAResultView.vue` (tooltips + separators; shared with paper detail), `packages/frontend/src/views/QAPage.vue` (refresh action + skeleton loading + pagination controls + page-level model fetch), `packages/frontend/src/stores/qa.ts` (feed pagination state + page-aware `fetchFeed` + shared `availableModels`/`fetchModels`), `packages/frontend/src/App.vue` (wrap the `<RouterView />` outlet in a `TooltipProvider` so page-content tooltips render).
- **Backend**: `packages/backend/src/api/qa.ts` — `GET /api/qa/free` gains `page`/`page_size` query params and returns a `{ data, pagination }` envelope (reuses the same `PaginatedResponse<T>` shape as `/api/papers`). Backward-compatible (defaults page 1 / size 20).
- **shadcn-vue components**: reuses already-installed `card`, `collapsible`, `tooltip`, `separator`, `checkbox`, `label`, `badge`, `button`, `dialog`; adds the `skeleton` component for loading placeholders.
- **No DB / schema changes.** No new runtime dependencies beyond the generated `skeleton` UI file.
- **Docs**: update `docs/frontend-architecture.md` (QA feed page / card composition + pagination notes).
