## Why

Paperland already ships a complete dark color-token set in `assets/main.css` (a `.dark` class redefining every `--background`/`--foreground`/… token plus a `dark` Tailwind variant), but nothing ever toggles it — the app is permanently light. Researchers often read papers at night, so we want a one-click way to switch between light, dark, and "follow system", including the PDF content itself (which pdf.js currently renders with a hard-coded white page).

## What Changes

- Add a **three-state theme switcher** that cycles **Light → Dark → System** on each click, placed in the **bottom-left** of the desktop sidebar (and the mobile drawer footer), next to the account/GitHub buttons.
- Persist the chosen mode to `localStorage`; on load, apply it before first paint (no flash of light theme).
- When mode is **System**, follow `prefers-color-scheme` live (react to OS theme changes) until the user picks an explicit mode.
- Toggle the existing `.dark` class on `<html>` so all already-defined dark tokens take effect across the whole UI — no per-component restyling needed.
- Make the **pdf.js viewer theme-aware**: in dark mode render pages with a **gray background and light (white) text** using pdf.js's native `pageColors: { background, foreground }` render option, and re-render visible pages when the theme changes. The hard-coded white `.pdf-page` background becomes theme-driven.

## Capabilities

### New Capabilities
- `theme-switcher`: A user-facing control that cycles between light / dark / system themes, persists the choice, follows the OS preference in system mode, and applies the active theme to the document (the `.dark` class) without a flash on load.

### Modified Capabilities
- `pdfjs-viewer`: PDF page rendering becomes theme-aware — in dark mode pages render with a gray background and light foreground text via pdf.js `pageColors`, and re-render when the active theme changes.

## Impact

- **Frontend only** — no backend, DB, or API changes.
- New file: `packages/frontend/src/stores/theme.ts` (Pinia store) and a `ThemeToggle.vue` component (or inline control) in the sidebar.
- Modified: `packages/frontend/src/App.vue` (mount the toggle + initialize the store), `packages/frontend/index.html` (pre-paint bootstrap script), `packages/frontend/src/components/PdfViewer.vue` (theme-aware rendering + page background), and `packages/frontend/src/assets/main.css` if any base tweak is needed.
- Docs: update `docs/frontend-architecture.md` (theme store + toggle) and `docs/tech-stack.md` if it enumerates UI features.
- No new dependencies (uses existing `@lucide/vue` icons, Pinia, Tailwind dark tokens, and pdf.js's built-in `pageColors`).
