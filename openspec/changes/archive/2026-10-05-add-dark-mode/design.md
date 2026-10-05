## Context

The frontend (Vue 3 + Vite + Pinia + Tailwind 4 + shadcn-vue) already defines a full dark palette in `packages/frontend/src/assets/main.css`:

- `@custom-variant dark (&:is(.dark *))` enables Tailwind `dark:` utilities.
- A `.dark { … }` block redefines every design token (`--background`, `--foreground`, `--card`, `--sidebar`, …) in OKLCH.
- `@theme inline { --color-*: var(--token) }` wires those tokens to Tailwind color classes.

So the entire UI is *already* dark-capable — it only needs the `.dark` class to be present on a root element. Nothing toggles it today, so the app is permanently light.

Two integration points need real work:

1. **App shell** (`App.vue`) — desktop icon sidebar has a bottom section (`App.vue:139`, the `flex flex-col items-center gap-1 pb-3` block) holding the account menu + GitHub link; the mobile drawer has an equivalent footer (`App.vue:214`). This is where the toggle goes. Note `useEmbedMode` hides the sidebar entirely when `?embed=1`, and an `?bg=RRGGBB` query param can force a background color.
2. **PDF viewer** (`PdfViewer.vue`) — pages are rasterized to `<canvas>` via `pdfjs-dist@5.4.149` (NOT the prebuilt `web/viewer.html` iframe). A transparent `.textLayer` overlays each canvas for selection. `.pdf-page` has a hard-coded `background: #fff` and text selection / region-flash highlights are CSS overlays *outside* the canvas raster.

Constraints: frontend-only change, snake_case for any persisted/serialized keys, no new dependencies.

## Goals / Non-Goals

**Goals**
- One control, bottom-left, cycling Light → Dark → System on each click.
- Persist the choice; apply it before first paint (no light-flash on reload).
- In System mode, follow `prefers-color-scheme` live.
- Whole UI switches via the existing `.dark` tokens.
- PDF content in dark mode shows a **gray background with light/white text**.

**Non-Goals**
- No per-user server-side theme storage (localStorage only).
- No new color palette / redesign — reuse existing `.dark` tokens as-is.
- No theming of third-party embedded content beyond the pdf.js canvas.
- No high-contrast/accessibility mode beyond dark.
- Not theming the `?bg=` embed override (embed mode keeps its caller-provided background).

## Decisions

### Decision 1: Three-state model (`light | dark | system`) with a derived `resolved` theme

**What**: A Pinia store `useThemeStore` holds `mode: 'light' | 'dark' | 'system'`. A computed `resolved: 'light' | 'dark'` collapses `system` to the current `matchMedia('(prefers-color-scheme: dark)')` value. The store owns a single side effect: add/remove `.dark` on `document.documentElement` whenever `resolved` changes, and persist `mode` to `localStorage['paperland_theme']`.

**Why**: Matches the requested cycle exactly and mirrors existing store conventions (composition-API stores; `papers.ts`/`qa.ts` already persist prefs to `localStorage` under `paperland_*` keys). Keeping a single DOM side effect in the store (not scattered in components) makes the toggle button, the boot script, and the PDF viewer all read one source of truth.

**Alternatives considered**:
- *Boolean light/dark only* — rejected; the requirement explicitly wants a "follow system" state.
- *VueUse `useDark`/`useColorMode`* — not a current dependency; adding it for ~30 lines of logic isn't worth a new dep, and we need custom pdf.js coupling anyway.

### Decision 2: Pre-paint bootstrap script in `index.html` to avoid a flash

**What**: Add a tiny inline `<script>` in `packages/frontend/index.html` `<head>` that, before the Vue bundle loads, reads `localStorage['paperland_theme']`, resolves `system` via `matchMedia`, and adds `.dark` to `<html>` if needed.

**Why**: Pinia/Vue only run after the module bundle loads; applying the class in `onMounted` would show a light flash on every dark-mode reload. An inline pre-paint script is the standard fix and is independent of the bundle. The store then re-reads the same key on init, so the two never disagree.

**Alternatives considered**:
- *Apply only in the store on mount* — rejected (visible FOUC).
- *SSR / server-set class* — N/A (client-only SPA).

### Decision 3: PDF dark rendering via pdf.js native `pageColors`, not a CSS `invert()` filter

**What**: When `resolved === 'dark'`, pass `pageColors: { background: '<gray>', foreground: '<near-white>' }` to `page.render({...})` in `PdfViewer.vue`. pdfjs-dist 5.4.149 documents this render option as "Overwrites background and foreground colors". Drive the gray/white values from the same CSS tokens (read via `getComputedStyle` of a token, or use fixed values like `#3a3a3a` background / `#e8e8e8` foreground that match the UI's dark surfaces). Also change `.pdf-page { background: #fff }` to a theme-driven value so the page "paper" and gutter match.

**Why**:
- The requirement is specifically *gray background + white text* — `pageColors` sets the two **independently**, which a single CSS `invert()` cannot (with pure invert, background and text luminance are complementary, so "gray bg" forces "gray text" too).
- It recolors *inside* the canvas raster, so the `.textLayer` selection highlight and `.pdf-region-flash` overlays (which sit above the canvas and use UI tokens) keep their correct colors automatically.
- It is pdf.js's own built-in mechanism (its forced-colors / high-contrast feature), i.e. the "PDF.js night mode" the request asked us to investigate — answer: there is no on/off "dark mode" switch, but `pageColors` is the supported primitive for it.

**Alternatives considered**:
- *CSS `filter: invert(1) hue-rotate(180deg)` on the canvas* — simpler and instant (no re-render), but can't produce independent gray-bg/white-text and inverts figure colors via a fixed transform; kept as a documented fallback only.
- *Prebuilt pdf.js `web/viewer.html` in an iframe with its dark theme* — would discard the app's custom canvas/text-layer/anchor integration; too invasive.

### Decision 4: Re-render visible PDF pages on theme change

**What**: `PdfViewer.vue` watches `themeStore.resolved`. On change it re-renders the live (rendered + in-flight) page(s) with the new `pageColors`; off-screen pages re-render lazily on scroll as today. The `rendered`/`renderTasks` entries carry a `dark` flag so the "already rendered at this scale" guard also re-renders when only the theme changed. It does **not** unrender first — see Decision 6.

**Why**: `pageColors` is baked into the rasterized canvas, so an already-rendered page won't recolor itself — it must be re-rasterized. Reusing the existing lazy-render path keeps this cheap (only visible pages re-raster immediately).

**Alternatives considered**:
- *Re-render every page eagerly* — wasteful for long PDFs; the viewer already renders lazily.
- *Overlay a CSS filter only on switch* — reintroduces the invert limitations of Decision 3.

### Decision 6: Off-DOM render + swap-on-complete to eliminate the white flash

**What**: Each page is rendered into a **freshly created, off-document `<canvas>`**; the finished canvas is inserted (first render) or swapped in via `replaceWith` (re-render/zoom/theme change) only **after** `renderTask.promise` resolves. The previously-rendered canvas stays in the DOM until the swap. The theme-change watcher therefore re-renders without unrendering first.

**Why**: pdf.js fills the canvas with its background color (`background || "#ffffff"`, `pdf.mjs` `beginDrawing`) at the **start** of every render and applies the dark `pageColors` HCM filter only at the **end** (`endDrawing → #drawFilter`). The old code appended the canvas to the DOM *before* awaiting the render, so the browser painted the "white fill → black text → dark filter" transition as a visible white flash in dark mode. Rendering off-DOM and swapping the already-dark canvas in means no intermediate frame is ever composited. Keeping the old canvas until the swap also removes the blank/gray gap that unrender-then-render produced on theme toggle, and keeps the page visible (CSS-stretched) during a zoom re-raster.

**Alternatives considered**:
- *Pass pdf.js's `background` render option* (e.g. dark gray) — rejected: the initial fill is then luminance-remapped by the same HCM `pageColors` filter, which breaks the gray-bg/white-text mapping (the filter assumes a white page).
- *Hide the canvas with CSS until `promise` resolves, reusing the same element* — works, but creating a fresh canvas and swapping is simpler, also fixes the zoom re-raster flash, and lets the old render stay visible meanwhile.
- *Keep reusing `ex.canvas` and append-before-render* — the original behavior; this is exactly what caused the flash.

### Decision 5: Toggle UI — single cycling icon button with a tooltip

**What**: A `ThemeToggle.vue` (or inline) ghost icon `Button` showing `Sun` (light), `Moon` (dark), or `Monitor` (system) from `@lucide/vue`, with a tooltip naming the *current* mode. Click advances Light → Dark → System → Light. Rendered in the desktop sidebar bottom block and the mobile drawer footer; hidden in embed mode (the whole sidebar is already hidden there).

**Why**: One button matching the existing ghost-icon + `Tooltip` pattern in `App.vue`; the icon doubles as the current-state indicator, so no extra menu is needed for a 3-state cycle.

**Alternatives considered**:
- *Dropdown with three explicit choices* — more discoverable but heavier; the request says "one-click toggle / cycle", so cycling wins. (A dropdown could be a later enhancement.)

## Risks / Trade-offs

- **Figure recoloring in PDFs**: `pageColors` luminance-maps everything, so figures/photos shift in dark mode. Accepted — typical of dark PDF readers; users can switch to Light to read a figure faithfully.
- **Re-render cost on toggle**: only visible pages re-raster immediately; acceptable. Mitigate by cancelling stale tasks (the viewer already does this per page).
- **localStorage unavailable / corrupt value**: guard reads in a `try/catch` and fall back to `system`; an unknown stored value is treated as `system`.
- **Boot script vs. store drift**: both read the same `paperland_theme` key and the same `matchMedia`, so they converge; the store is authoritative after mount.
- **Embed mode**: toggle hidden and `?bg=` override untouched, so existing embed behavior is preserved.

## Migration Plan

Additive, no migration. Default `mode` is `system`, so existing users get OS-appropriate theming on first load; anyone who previously only saw light will now follow their OS unless they pick Light explicitly. No data or API changes; ship in one PR.

## Open Questions

- ~~Exact dark PDF colors~~ — **Resolved during apply**: `DARK_PAGE_COLORS = { background: '#3a3a3a', foreground: '#e8e8e8' }` (gray page, near-white text), mirrored by `:global(.dark) .pdf-page { background: #3a3a3a }` so the loading gutter matches the rasterized page.
- Whether to also expose the toggle somewhere for embed mode — deferred; out of scope for now.

## Apply notes (resolved decisions)

- **Toggle is inline in `App.vue`**, not a separate `ThemeToggle.vue` (Decision 5 allowed either) — it matches the surrounding inline account/GitHub controls and avoids juggling a `variant` prop across the two different layouts (desktop icon-in-tooltip vs full-width drawer button). `themeIcon`/`themeLabel` computeds drive the icon and tooltip.
- **Re-render on theme change** (Decisions 4 + 6) is implemented as: collect the live page numbers (`rendered` ∪ `renderTasks` keys) and call `renderPage` on each. `renderPage` renders into a fresh off-DOM canvas and swaps it in only when done, so the old canvas stays visible until the new (correctly-colored) one is ready — no unrender, no blank, no white flash. The `dark` flag on the `rendered`/`renderTasks` entries makes the same-scale guard re-render when only the theme changed. Off-screen pages were never rendered, so they pick up the new colors lazily on scroll.
- **White-flash fix** (Decision 6): the original code appended the canvas to the DOM *before* awaiting the render, exposing pdf.js's white-fill-then-dark-filter transition. Now every render targets an off-DOM canvas inserted/swapped post-completion. Verified: `vue-tsc -b` + `vite build` both pass.
