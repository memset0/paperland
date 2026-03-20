## Context

The Paperland frontend uses a responsive layout in `App.vue`:
- **Desktop (≥768px)**: Fixed left sidebar (`w-52` expanded / `w-[52px]` collapsed) with full-height `h-screen` and a "Paperland" header at `h-14` (56px).
- **Mobile (<768px)**: Fixed top navbar at `h-12` (48px) + slide-in overlay drawer also at `h-12`.

Two issues exist in the desktop layout:
1. The sidebar header (`h-14` = 56px) is taller than the page-level header in `PaperDetail.vue` (`py-2.5` ≈ 40px), causing misaligned horizontal borders.
2. The sidebar defaults to expanded (`w-52`), consuming 208px of horizontal space that could be used for content.

## Goals / Non-Goals

**Goals:**
- Pixel-perfect alignment of the sidebar header border with the adjacent page header border on desktop
- Desktop sidebar defaults to collapsed (icon-only) mode, expanding only on explicit user action
- Smooth, consistent transitions between collapsed/expanded states

**Non-Goals:**
- Changing mobile layout (already works well)
- Persisting sidebar state across page reloads (can be added later)
- Changing navigation items or page content

## Decisions

### 1. Unified header height: `h-12` (48px)

Change the desktop sidebar header from `h-14` to `h-12`. Change PaperDetail's page header from `py-2.5` to explicit `h-12` with flex centering. This matches the mobile navbar height (already `h-12`), creating consistency across all breakpoints.

**Alternative considered**: Make everything `h-14` — rejected because mobile is already `h-12` and works well; 48px is sufficient for the header content.

### 2. Default-collapsed sidebar with three-dots expand trigger

- `collapsed` ref initializes to `true` instead of `false`
- Replace `ChevronLeft`/`ChevronRight` toggle icons with `MoreHorizontal` (lucide) as the expand trigger when collapsed
- When expanded, use `X` or `ChevronLeft` to collapse back
- The bottom toggle button position stays the same (`border-t`, full width of sidebar)

**Alternative considered**: Hover-to-expand — rejected because it's unreliable (accidental triggers) and inaccessible.

### 3. Keep existing width values

Collapsed: `w-[52px]` (fits 20px icon + padding comfortably). Expanded: `w-52` (208px). These values are already working well.

## Risks / Trade-offs

- [Users may miss the three-dots button] → The icon-only collapsed sidebar clearly shows navigation icons as visual affordance; the three-dots at the bottom is a conventional "more" pattern.
- [Page headers that don't have an explicit `h-12` may look inconsistent] → PaperList, QAPage, etc. don't have a top "appbar" bar — they use inline `p-6` headers. This only matters for PaperDetail which has the split-pane header bar. We fix PaperDetail specifically.
