## 1. Unify Header Heights

- [x] 1.1 In `App.vue`, change desktop sidebar header from `h-14` to `h-12` (line 41)
- [x] 1.2 In `PaperDetail.vue`, change the page header from `py-2.5` to explicit `h-12` with flex vertical centering (line 108)

## 2. Default-Collapsed Sidebar with Three-Dots Trigger

- [x] 2.1 In `App.vue`, change `collapsed` ref initial value from `false` to `true`
- [x] 2.2 Replace `ChevronLeft`/`ChevronRight` imports with `MoreHorizontal` (plus keep `ChevronLeft` for expanded state) from `lucide-vue-next`
- [x] 2.3 Update the bottom toggle button: show `MoreHorizontal` icon when collapsed, `ChevronLeft` icon when expanded
- [x] 2.4 Verify collapsed sidebar shows only icons (BookOpen in header, nav item icons) with no text labels, centered in 52px width

## 3. Verify & Polish

- [x] 3.1 Visually verify desktop sidebar header border aligns with PaperDetail page header border
- [x] 3.2 Visually verify sidebar expand/collapse transition is smooth (~200ms)
- [x] 3.3 Verify mobile layout is completely unchanged (top navbar + overlay drawer)
