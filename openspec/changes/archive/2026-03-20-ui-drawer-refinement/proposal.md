## Why

Desktop layout has two visual inconsistencies: (1) the sidebar "Paperland" header is `h-14` (56px) while the adjacent page header (e.g., PaperDetail) uses `py-2.5` (~40px), creating a misaligned border-bottom — even though mobile mode already has both at a consistent `h-12` (48px); (2) the expanded sidebar takes too much horizontal space by default, reducing the useful content area.

## What Changes

- **Unify header heights**: Change desktop sidebar header from `h-14` to `h-12` (48px), matching mobile navbar/drawer header. Adjust PaperDetail's page header to also use `h-12` for pixel-perfect alignment with the sidebar header border.
- **Default-collapsed sidebar**: Desktop sidebar defaults to collapsed (icon-only, ~52px wide). The bottom toggle button changes from chevron icons to a "three dots" (⋯) icon. Clicking the three dots expands the sidebar to full width (`w-52`). When expanded, clicking the same button (or a close variant) collapses it back.
- **Smooth transitions**: Keep existing `transition-all duration-200` for width changes; icons and labels animate naturally.

## Capabilities

### New Capabilities

- `collapsed-sidebar`: Desktop sidebar defaults to collapsed icon-only mode with three-dots expand trigger

### Modified Capabilities

_(none — this is purely a frontend UI/layout change with no spec-level behavior changes)_

## Impact

- **Files**: `packages/frontend/src/App.vue` (sidebar layout + collapse logic), `packages/frontend/src/views/PaperDetail.vue` (header height alignment)
- **No API/backend/database changes**
- **No dependency changes**
- **Visual-only**: Affects desktop viewport ≥768px; mobile layout unchanged
