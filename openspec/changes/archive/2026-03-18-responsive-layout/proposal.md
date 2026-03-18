## Why

The current sidebar navigation is always visible and doesn't adapt to narrow screens. On mobile/tablet, the sidebar wastes horizontal space and makes the content area too cramped. Need a responsive layout that converts the sidebar to a top navbar + hamburger menu drawer on narrow screens.

## What Changes

- Wide screens (>=768px): keep current sidebar layout
- Narrow screens (<768px): hide sidebar, show a top navbar with app title + hamburger button
- Hamburger button opens a slide-out drawer overlay with the same nav links
- Clicking a nav link or the backdrop closes the drawer
- Paper detail page: already handled (single column on narrow screens)

## Capabilities

### New Capabilities
- `responsive-nav`: Adaptive navigation that switches between sidebar (desktop) and top navbar + drawer (mobile/narrow screens)

### Modified Capabilities
(none)

## Impact

- **Modified**: `packages/frontend/src/App.vue` only
- No backend changes, no new dependencies
