## Why

In embed mode (`?embed=1`), the paper detail page still applies the dual-column split view on wide screens (>=900px). Since embed mode is designed for constrained containers (e.g., Zotero sidebar), dual-column layout is inappropriate and should always use single-column regardless of viewport width.

## What Changes

- Force single-column layout in PaperDetail.vue when embed mode is active, bypassing the `isWide` responsive breakpoint check.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `embed-mode`: Add requirement that embed mode always forces single-column layout in paper detail view, disabling the split/dual-column view entirely.

## Impact

- `packages/frontend/src/views/PaperDetail.vue` — layout conditional logic needs to account for embed mode
