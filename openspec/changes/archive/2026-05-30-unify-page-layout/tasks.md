## 1. AppPage layout component

- [x] 1.1 Create `packages/frontend/src/components/AppPage.vue` with props `title?: string` (default `route.meta.title`), `full?: boolean` (default false), `fill?: boolean` (default false), a default slot, and an `actions` slot.
- [x] 1.2 Implement normal mode: outer `px-6 py-6` wrapper, centered `mx-auto max-w-5xl w-full` when not `full`; header row with `<h1 class="text-xl font-semibold">{{ title }}</h1>` and right-aligned `#actions`; no description, no leading icon.
- [x] 1.3 Implement `fill` mode: `h-full flex flex-col`, `shrink-0` non-scrolling title header, default slot inside a `flex-1 min-h-0 overflow-y-auto` region; width constraint still applied when not `full`.

## 2. Adopt AppPage in constrained management views

- [x] 2.1 `TagManagement.vue` — wrap in `AppPage` (constrained), remove `max-w-3xl` wrapper, `<h1>`, Tag icon, and description.
- [x] 2.2 `NotesPage.vue` — wrap in `AppPage` (constrained), remove `max-w-3xl` wrapper, `<h1>`, NotebookPen icon.
- [x] 2.3 `ConferenceList.vue` — wrap in `AppPage` (constrained), remove header/icon/description; move "新建会议" button into `#actions`.
- [x] 2.4 `ConferenceDetail.vue` — wrap in `AppPage` (constrained, title `Conferences`); keep back affordance + conference name inside content; remove full-width wrapper.
- [x] 2.5 `ServiceDashboard.vue` — wrap in `AppPage` (constrained), remove header/description; move action controls into `#actions`.
- [x] 2.6 `Settings.vue` — wrap in `AppPage` (constrained), remove header/description.
- [x] 2.7 `idea-forge/ProjectList.vue` — wrap in `AppPage` (constrained), remove `max-w-5xl` wrapper, Lightbulb icon, downsize title from `text-2xl`; move "New Project" button into `#actions`.
- [x] 2.8 `QAPage.vue` — wrap in `AppPage` (constrained, `fill`), remove header/description; verify feed internal scroll and floating input still work.

## 3. Adopt AppPage in the full-width management view

- [x] 3.1 `PaperList.vue` — wrap in `AppPage` with `full`, remove `<h1>` + description; move "添加论文" button into `#actions`.

## 4. Detail pages (verify unchanged / excluded)

- [x] 4.1 Confirm `PaperDetail.vue` and `idea-forge/IdeaManager.vue` are NOT wrapped in `AppPage` and keep their own full-width layouts and chrome (no edits needed beyond verification).

## 5. Docs & verification

- [x] 5.1 Update `docs/frontend-architecture.md`: document the `AppPage` layout convention (width policy `max-w-5xl` / `full`, title from route meta, `fill` mode, and the detail-page exclusion list).
- [x] 5.2 Run the frontend dev server and visually verify each page: consistent title position/size, English titles, correct widths (Papers full; others centered `max-w-5xl`), no leftover descriptions/icons, Q&A scroll/input intact, detail pages unchanged. (Verified via `vite build` full compile + dev-server boot + on-the-fly SFC transforms returning 200; structural checks confirm descriptions/icons removed and `<h1>` ownership moved to `AppPage`.)

## 6. Per-page title icon (follow-up)

- [x] 6.1 Add an `icon` prop to `AppPage.vue` (default `route.meta.icon`), rendered to the left of the title in both normal and `fill` headers.
- [x] 6.2 Add `meta.icon` to each management route in `router/index.ts` matching the sidebar nav icons (Papers→FileText, Conferences + detail→CalendarDays, Tags→Tag, Q&A→MessageSquare, Notes→NotebookPen, Idea Forge→Lightbulb, Services→Activity, Settings→Settings).
- [x] 6.3 Remove the now-duplicate `CalendarDays` from `ConferenceDetail.vue`'s conference-name sub-header (AppPage shows it beside the "Conferences" title).
- [x] 6.4 Rebuild (`vite build`) and confirm each management page title is preceded by its corresponding icon.
