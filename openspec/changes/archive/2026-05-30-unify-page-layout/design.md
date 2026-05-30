## Context

Paperland's frontend is a Vue 3 SPA. The app shell (`App.vue`) renders a fixed 52px icon sidebar (desktop) / top navbar + drawer (mobile) and a single `<main class="flex-1 overflow-y-auto overflow-x-hidden">` outlet that hosts `<RouterView />`. There is **no layout abstraction** — every view owns its outermost wrapper, and the conventions diverged:

| View | Width | Title markup |
|---|---|---|
| `PaperList` (`/`) | none (full) | `text-xl font-semibold` "论文管理" + description |
| `TagManagement` (`/tags`) | `max-w-3xl` | `text-xl` + Tag icon + description |
| `QAPage` (`/qa`) | none (full, `h-full flex` internal scroll) | `text-xl` "Q&A" + description |
| `NotesPage` (`/notes`) | `max-w-3xl` | `text-lg` + NotebookPen icon, no description |
| `ConferenceList` (`/conferences`) | none (full) | `text-xl` + CalendarDays icon + description |
| `ConferenceDetail` (`/conferences/:id`) | none (full) | own detail header |
| `ServiceDashboard` (`/services`) | none (full) | `text-xl` "服务管理" + description |
| `Settings` (`/settings`) | none (full) | `text-xl` "设置" + description |
| `ProjectList` (`/idea-forge`) | `max-w-5xl` | `text-2xl font-bold` + Lightbulb icon |
| `IdeaManager` (`/idea-forge/:projectName`) | none (full) | own detail header |
| `PaperDetail` (`/papers/:id`) | split / `max-w-3xl` narrow | own detail header |

Each route already carries an English `meta.title` (`Papers`, `Tags`, `Q&A`, `Notes`, `Conferences`, `Services`, `Settings`, `Idea Forge`) used for `document.title` (the `page-title` capability) and matching the sidebar labels. We can reuse it as the single source of truth for the in-page title.

Constraints:
- Tailwind v4 + shadcn-vue only; no new deps.
- `PaperDetail` narrow/embed widths are normative in the `embed-mode` spec (`p-5 space-y-5 max-w-3xl mx-auto pb-40` non-embed → `p-2 space-y-2` embed). They must not be touched.
- Q&A relies on `h-full flex flex-col overflow-hidden` with an inner scroll region (and a floating input, `qa-input-floating`). The layout must preserve full-height internal scroll.

## Goals / Non-Goals

**Goals:**
- One shared component owns page title (fixed position, consistent size, English from `route.meta.title`, no icon, no description) and content width.
- Standard centered width `max-w-5xl` for management pages; explicit opt-in full width for Papers.
- Detail pages keep their own layouts and are explicitly excluded.
- Minimal churn: `App.vue`, router, `PaperDetail`, and `IdeaManager` stay as-is.

**Non-Goals:**
- Sticky/persistent header on scroll (deferred; current scroll-away behavior kept).
- Any change to the sidebar, logo asset (keep `BookOpen`), or navigation.
- Changing `PaperDetail` / `IdeaManager` internal layout or `embed-mode` behavior.
- Backend/API/router/meta changes.

## Decisions

### D1: Per-view `<AppPage>` wrapper, not route-meta-driven layout switching in `App.vue`
Each management view wraps its content in `<AppPage> … </AppPage>`. `App.vue`'s `<main>` outlet is unchanged.

- **Why:** Per-view wrapping lets each page declare its own `#actions` (e.g. PaperList's "添加论文", ConferenceList's "新建会议") and its mode (`full` / `fill`) locally, without a teleport/provide mechanism to project action buttons into a global header. Detail pages opt out simply by not using the component.
- **Alternative considered:** Drive layout from `route.meta.layout` and have `App.vue` wrap `<RouterView>` in the chosen layout. Rejected: projecting per-page action buttons and per-page `fill`/`full` flags into a shell-level header needs slots-through-router-view or teleport, which is more machinery than the problem warrants.

### D2: `AppPage` API
```
Props:
  title?: string    // defaults to route.meta.title; in-page header text (no description line)
  icon?: Component  // defaults to route.meta.icon; rendered to the left of the title
  full?: boolean    // false → centered max-w-5xl; true → full-bleed width
  fill?: boolean    // false → normal document flow (scrolls with <main>);
                    // true  → h-full flex flex-col, content area is flex-1 min-h-0 overflow-y-auto
Slots:
  #actions   // optional, right-aligned in the header row
  default    // page content
```
Structure (normal mode):
```
<div class="px-6 py-6" + (full ? "" : " mx-auto max-w-5xl w-full")>
  <header class="flex items-center justify-between gap-3 mb-4 sm:mb-6">
    <h1 class="flex items-center gap-2 text-xl font-semibold">
      <component :is="icon" v-if="icon" class="h-5 w-5 shrink-0 text-primary" /> {{ title }}
    </h1>
    <div v-if="$slots.actions"><slot name="actions" /></div>
  </header>
  <slot />
</div>
```
Structure (`fill` mode): outer `h-full flex flex-col`; the title header is `shrink-0` (does not scroll); the default slot lives in a `flex-1 min-h-0 overflow-y-auto` region so pages like Q&A keep internal scroll. The width constraint (`mx-auto max-w-5xl`) still applies to both the header and the scroll region in non-`full` mode.

- **Title size:** unify on `text-xl font-semibold` (the most common existing value) for all pages, replacing the `text-lg` (Notes) and `text-2xl font-bold` (Idea Forge) outliers.
- **Title source:** default to `route.meta.title` so the in-page title always matches the sidebar label and the browser tab; allow a `title` prop override for any view that needs a different string.
- **Title icon:** each management route declares `meta.icon` (the same icon the sidebar uses for that page) in `router/index.ts`; `AppPage` reads `route.meta.icon` by default and renders it to the left of the title, overridable via an `icon` prop. Defining it once in route meta keeps the page icon and the sidebar nav icon from drifting. `ConferenceDetail` drops the duplicate `CalendarDays` it used to render beside the conference name, since `AppPage` now shows it beside the "Conferences" title.

### D3: Per-route classification
- **`full` (management layout, full width):** `/` Papers.
- **Constrained management layout (`max-w-5xl`):** `/tags`, `/qa` (with `fill`), `/notes`, `/conferences`, `/conferences/:id`, `/services`, `/settings`, `/idea-forge`.
- **Excluded — keep own detail layout, full width, no management title bar:** `/papers/:id` (PaperDetail), `/idea-forge/:projectName` (IdeaManager).

`ConferenceDetail` is intentionally a constrained management page (per product decision): it shows the unified `Conferences` title via `AppPage` and keeps its back affordance + the specific conference name within the content region.

### D4: Remove per-page chrome on adoption
When a view adopts `AppPage`, delete its bespoke outer width wrapper, its `<h1>` + leading icon, and its description `<p>`. Action buttons move into the `#actions` slot. `space-y-*` / inner spacing the page needs stays inside the default slot.

## Risks / Trade-offs

- [Q&A nested-scroll regression] Moving Q&A under `AppPage` `fill` mode could break its internal scroll or floating input. → `fill` mode reproduces Q&A's existing `h-full flex flex-col` + inner `flex-1 min-h-0 overflow-y-auto` exactly; verify the floating input and scroll after refactor.
- [ConferenceDetail title feels generic] Showing "Conferences" as the title on a single-conference page is less specific than its current dynamic header. → Mitigated by keeping the conference name + back button inside the content region; this matches the chosen product decision and keeps width consistent.
- [max-w-5xl too narrow for Services/Settings dense content] Some admin pages were full-width before. → Accepted per product decision (unify on `max-w-5xl`); `full` remains available if a page later proves it needs full width.
- [Title scrolls away] Long pages lose the title on scroll. → Explicitly deferred (non-goal); current behavior retained.

## Migration Plan

Pure frontend, incremental and low-risk:
1. Add `AppPage.vue`.
2. Convert views one at a time (constrained pages first, then `PaperList` with `full`, then `QAPage` with `fill`), checking each renders correctly.
3. Update `docs/frontend-architecture.md`.
4. Rollback = revert the per-view edits; `AppPage.vue` is additive and inert if unused.

## Open Questions

None — width (`max-w-5xl`), title language (English from meta), Conference detail classification (constrained), and sidebar logo (keep `BookOpen`) are all resolved.
