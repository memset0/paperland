## 1. Theme store

- [x] 1.1 Create `packages/frontend/src/stores/theme.ts` (`useThemeStore`, composition-API style matching existing stores) with `mode: Ref<'light' | 'dark' | 'system'>` initialized from `localStorage['paperland_theme']` (guarded `try/catch`, default `'system'` on missing/invalid/unavailable).
- [x] 1.2 Add a `resolved` computed (`'light' | 'dark'`) that collapses `'system'` to the current `matchMedia('(prefers-color-scheme: dark)')` value.
- [x] 1.3 Add a `cycle()` action advancing Light → Dark → System → Light, and a `setMode(mode)` action; persist `mode` to `localStorage['paperland_theme']` on change.
- [x] 1.4 Apply the side effect: a `watch`/`watchEffect` that toggles the `.dark` class on `document.documentElement` whenever `resolved` changes.
- [x] 1.5 Register a `matchMedia('(prefers-color-scheme: dark)')` change listener so `resolved` updates live while in `system` mode.

## 2. Pre-paint bootstrap (no flash)

- [x] 2.1 Add an inline `<script>` in `packages/frontend/index.html` `<head>` that reads `localStorage['paperland_theme']`, resolves `system` via `matchMedia`, and adds `.dark` to `<html>` before the bundle loads. Keep it tiny and dependency-free; use the same key/logic as the store so they converge.

## 3. Toggle control in app chrome

- [x] 3.1 Implemented **inline in `App.vue`** (the spec allowed "or inline"): a ghost icon `Button` showing `Sun`/`Moon`/`Monitor` (`@lucide/vue`) for the current mode via `themeIcon`/`themeLabel` computeds, calling `theme.cycle()` on click, with a `Tooltip` naming the current mode. Inline matches the surrounding account/GitHub controls and avoids variant-prop juggling across the two layouts.
- [x] 3.2 Mount it in the desktop sidebar bottom block (the `flex flex-col items-center gap-1 pb-3` group) as the first control, wrapped in the existing `Tooltip` pattern.
- [x] 3.3 Mount an equivalent in the mobile drawer footer (the `border-t p-2 space-y-1` block), full-width with visible label; keeps the drawer open so the user can cycle repeatedly.
- [x] 3.4 Ensure the toggle is not rendered in embed mode (it lives inside the sidebar/drawer, which are already hidden when `isEmbed`).
- [x] 3.5 Initialize the store early in `App.vue` setup (`const theme = useThemeStore()`) so the apply side effect + system-preference listener are active for the session.

## 4. Theme-aware PDF rendering

- [x] 4.1 In `PdfViewer.vue`, import `useThemeStore` and read `theme.resolved`.
- [x] 4.2 When `resolved === 'dark'`, pass `pageColors: DARK_PAGE_COLORS` (`{ background: '#3a3a3a', foreground: '#e8e8e8' }`) to `page.render({...})`; `undefined` in light mode.
- [x] 4.3 Add a dark-mode override for the hard-coded white page: `:global(.dark) .pdf-page { background: #3a3a3a }` (matches `pageColors.background`); text-selection and `.pdf-region-flash` overlays sit above the canvas and keep their UI-token colors.
- [x] 4.4 Add a `watch(() => theme.resolved, …)` that re-renders the live (rendered + in-flight) pages with the new colors; off-screen pages render fresh when scrolled in. (Does NOT unrender first — the off-DOM swap in 4.5 keeps the old canvas visible until the new one is ready.)
- [x] 4.5 **Fix dark-mode white flash**: render each page into a fresh **off-DOM** `<canvas>` and insert/swap it in only after `renderTask.promise` resolves (pdf.js white-fills the canvas at render start and applies `pageColors` only at render end, so an in-DOM canvas flashes white → dark). Carry a `dark` flag on the `rendered`/`renderTasks` entries so the same-scale guard re-renders on theme change. Also removes the zoom-re-raster flash and the unrender-induced blank on theme toggle.

## 5. Docs & spec sync

- [x] 5.1 Updated `docs/frontend-architecture.md` (re-applied after a concurrent wholesale rewrite of the file settled): the "主题" UI-stack bullet now notes明暗切换 is driven by `stores/theme.ts`; a new "### 主题切换（夜间模式）" subsection (store/cycle/persistence, FOUC bootstrap, bottom-left placement, embed-hidden); and a PdfViewer "主题感知渲染（夜间模式）" bullet (pdf.js `pageColors` gray `#3a3a3a`/near-white `#e8e8e8` + re-render visible pages on theme change). All three verified present.
- [x] 5.2 `docs/tech-stack.md` — no change needed: its source tree only lists `stores/` (not individual stores) and the OKLCH theme is already documented. (A concurrent agent was mid-edit on this file; left untouched per the shared-tree protocol.)
- [x] 5.3 Folded apply-time decisions back into `design.md` (resolved the dark-color open question to `#3a3a3a`/`#e8e8e8`; recorded inline-in-App.vue over a separate component; re-render = re-render the rendered set).

## 6. Validation

- [x] 6.1 Run `bun run dev` from project root; verify cycling Light → Dark → System updates the whole UI and the bottom-left icon/tooltip. *(manual browser check passed)*
- [x] 6.2 Reload in dark mode and confirm there is no flash of the light theme. *(manual browser check passed)*
- [x] 6.3 In system mode, change the OS color scheme and confirm the UI follows live. *(manual browser check passed)*
- [x] 6.4 Open a paper PDF and confirm dark mode shows a gray background with light text, that toggling re-renders the visible page, and that selection-highlight + region-flash overlays remain correct. *(manual browser check passed)*
- [x] 6.5 Confirm embed mode (`?embed=1`) is unaffected (no toggle shown, `?bg=` override intact). *(manual browser check passed)*
- [x] 6.6 `bun run build` (`vue-tsc -b && vite build`) passes — no type errors, 2675 modules transformed, dark-mode code compiles into the production bundle.
