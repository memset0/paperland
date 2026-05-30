## Why

The various "XX 管理" pages (Papers, Tags, Q&A, Conferences, Notes, Services, Settings, Idea Forge) each hand-roll their own page wrapper: inconsistent content widths (`max-w-3xl` / `max-w-5xl` / no constraint), inconsistent title size and language (`text-xl` vs `text-2xl`, Chinese `论文管理` vs English `Notes`), per-page leading icons, and redundant one-line descriptions (`管理你的学术论文库`). The result feels visually disjointed. We want a single shared page layout that fixes the title position, size, language, and content width in one place, so management pages look unified and individual views stop owning their chrome.

## What Changes

- Introduce a shared **`AppPage`** layout component (`packages/frontend/src/components/AppPage.vue`) that renders, at a consistent position and size, an English page title sourced from `route.meta.title`, **preceded by the page's corresponding icon** (sourced from `route.meta.icon`, the same icon the sidebar uses for that page; overridable via an `icon` prop), with an optional right-aligned `#actions` slot and a default content slot. It supports a `full` prop (full-bleed width) and a `fill` prop (full-height internal scroll, for pages like Q&A). The title has **no description paragraph**.
- Add `meta.icon` to each management route in the router so the per-page icon is defined once and shared by `AppPage` (and consistent with the sidebar nav icons).
- Standardize constrained content width to **`max-w-5xl` (1024px), centered** for all management pages, applied by the layout (not per-view).
- Adopt `AppPage` in the management views and remove their bespoke headers / descriptions / hand-rolled width wrappers (their leading title icon, where present, is replaced by the layout-driven `meta.icon`):
  - **Constrained (max-w-5xl):** Tags, Q&A (fill mode), Notes, Conferences list, Conference detail, Services, Settings, Idea Forge project list.
  - **Full width (`full`):** Papers (论文管理) — keeps full page width for its table.
- **Exclude detail pages from `AppPage`.** Paper detail (`/papers/:id`) and the Idea Forge idea workspace (`/idea-forge/:projectName`) keep their own full-width, self-managed layouts with their own chrome (back button, split view) and **no** management title bar. Their existing behavior — including PaperDetail's embed/narrow rendering — is unchanged.
- The desktop sidebar continues to show the existing `BookOpen` logo icon at top (unchanged); after this change it is the sole brand mark since per-page title icons are removed.
- Update `docs/frontend-architecture.md` to document the layout convention (which pages use `AppPage`, the width policy, and the detail-page exclusion).

Non-goal (explicitly deferred): a sticky/persistent header that keeps the title visible while scrolling. Current behavior (title scrolls away) is retained.

## Capabilities

### New Capabilities
- `page-layout`: A shared frontend page layout (`AppPage`) that owns page title rendering (fixed position, consistent size, English from route meta, no description/icon) and content width policy (centered `max-w-5xl` by default, opt-in full-width), plus the classification of which routes use the management layout vs. keep their own detail layout.

### Modified Capabilities
<!-- None. Existing capabilities are not changed:
     - responsive-nav / collapsed-sidebar: sidebar unchanged (BookOpen kept).
     - embed-mode: PaperDetail is excluded from AppPage, so its narrow/embed widths are untouched.
     - page-title: in-page title reuses route.meta.title; document.title behavior unchanged. -->

## Impact

- **Affected code (frontend only):**
  - New: `packages/frontend/src/components/AppPage.vue`.
  - Refactored views: `PaperList.vue`, `TagManagement.vue`, `QAPage.vue`, `NotesPage.vue`, `ConferenceList.vue`, `ConferenceDetail.vue`, `ServiceDashboard.vue`, `Settings.vue`, `idea-forge/ProjectList.vue` (wrap in `AppPage`, drop bespoke header/description/icon/width).
  - Router: `router/index.ts` adds `meta.icon` to each management route.
  - Unchanged: `App.vue` (sidebar/logo), `PaperDetail.vue`, `idea-forge/IdeaManager.vue`.
- **APIs / backend / DB:** none.
- **Docs:** `docs/frontend-architecture.md`.
- **Risk:** Q&A's full-height internal scroll + floating input must keep working under `AppPage` `fill` mode; verify no nested-scroll regression.
