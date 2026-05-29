## Why

The sidebar navigation buttons navigate via a programmatic `router.push()` click handler instead of real anchor links. This breaks the browser's native "open in new tab" behavior: ctrl/cmd-click (and middle-click) still navigates in the current tab. The buttons also inherit a global 1px press-displacement effect that the user finds distracting on the sidebar.

## What Changes

- Sidebar navigation buttons (desktop icon rail + mobile drawer) become real links so that **ctrl/cmd-click and middle-click open the target page in a new tab**, while a plain click still does in-app SPA navigation.
- Preserve the existing login/admin gating: a plain click on a restricted item the current user cannot access still prompts for login or signals "requires admin" instead of navigating. (Gated items the user cannot access do not need a new-tab affordance.)
- Remove the **press-displacement effect** (the 1px downward shift on `:active`) **from sidebar navigation buttons only**; all other buttons across the app keep their current press effect.
- The mobile drawer still closes when a navigation item is selected via a plain click.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `responsive-nav`: sidebar/drawer navigation items gain a new-tab affordance on modifier/middle click, and the sidebar's nav buttons no longer show the press-displacement effect. Existing gating and drawer behavior are preserved.

## Impact

- `packages/frontend/src/App.vue` — desktop sidebar nav buttons (`navItems` loop) and mobile drawer nav buttons; the `go()` navigation handler.
- `packages/frontend/src/components/ui/button/index.ts` — only consulted; the global press effect stays. The displacement is suppressed on sidebar buttons via a scoped class, not by editing the shared base style.
- Docs: `docs/frontend-architecture.md` (sidebar navigation behavior).
- No backend, API, schema, or dependency changes.
