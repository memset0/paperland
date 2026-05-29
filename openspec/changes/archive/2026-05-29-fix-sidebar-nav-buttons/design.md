## Context

The sidebar (desktop icon rail in `<aside>` and mobile drawer in `SheetContent`) renders each navigation item as a shadcn-vue `Button` with `@click="go(item)"`. `go()` runs login/admin gating and then calls `router.push(item.path)`. Because the click handler is the only navigation path and there is no real `href`, the browser cannot apply its native "open in new tab" behavior — ctrl/cmd-click and middle-click are swallowed and navigate in the current tab.

Separately, the shared `Button` base style in `packages/frontend/src/components/ui/button/index.ts` includes `active:not-aria-[haspopup]:translate-y-px`, a global 1px downward shift on press. The user wants this removed **only** on the sidebar; all other buttons keep it.

Constraints:
- shadcn-vue `Button` supports `as-child`, which delegates rendering to a single child element (the pattern is already used for the GitHub link: `<Button as-child><a href ...></a></Button>`).
- vue-router is available; `router.resolve(path).href` yields a correct URL respecting the router base/history mode.
- The shared `Button` base style must NOT change (would affect every button app-wide).

## Goals / Non-Goals

**Goals:**
- ctrl/cmd-click and middle-click on an accessible sidebar nav item open its page in a new tab; the current tab is unchanged.
- A plain (unmodified, left) click keeps in-app SPA navigation and, on mobile, closes the drawer.
- Existing login/admin gating is preserved: a plain click on a restricted item the current user cannot access still prompts login / signals "requires admin" and does not navigate.
- Remove the press-displacement (`translate-y` on `:active`) from sidebar nav buttons only.

**Non-Goals:**
- Changing the global press effect on non-sidebar buttons.
- Changing routing, auth, or the set/order of nav items.
- Adding a new-tab affordance to gated items the current user cannot access (no useful destination to open).
- Restyling or restructuring the sidebar/drawer beyond these two fixes.

## Decisions

### Decision 1: Render nav items as `Button as-child` wrapping a single `<a>` with a conditional `href`

Each nav item becomes:

```vue
<Button as-child variant=... :class="[...existing classes...]">
  <a :href="navHref(item)" @click="onNavClick($event, item)">
    <component :is="item.icon" /> <!-- + label/badges for mobile -->
  </a>
</Button>
```

- `navHref(item)` returns `router.resolve(item.path).href` for items the current user **can** access, and `undefined` for gated items the user cannot access. An `<a>` without `href` is not a real link, so ctrl/cmd/middle-click do nothing on gated items — matching the gating spec ("prompt for login instead of navigating").
- `onNavClick(e, item)`:
  - If the item is accessible **and** a modifier key is held (`metaKey || ctrlKey || shiftKey || altKey`), `return` early without `preventDefault()` → the browser performs its native open-in-new-tab/window. (Middle-click opens the `href` natively and does not fire `click`, so it needs no handling.)
  - Otherwise `e.preventDefault()`, then run the **same gating logic currently in `go()`** (admin check → login check) and, if allowed, `drawerOpen.value = false` + `router.push(item.path)` when the path differs.

This keeps a single template element per item (no `v-if`/`v-else` duplication across desktop + mobile) while precisely honoring gating. `go()` is refactored into `onNavClick` (gating logic reused verbatim).

**Alternatives considered:**
- *Branch accessible vs gated (`<RouterLink>` for accessible, plain `<Button @click>` for gated).* Idiomatic, but doubles the template at both the desktop and mobile render sites. Rejected for verbosity; the conditional-`href` single element is equivalent and shorter.
- *Always render a real `href` and intercept in the handler.* Simpler handler, but middle-click on a gated item would open its page in a new tab (bypassing the login prompt). Rejected — violates gating intent.
- *Use `<RouterLink custom>`.* More machinery than needed; the `<a>` + `router.resolve` covers it.

### Decision 2: Generate the href with `router.resolve(item.path).href`

Rather than binding `item.path` directly, use `router.resolve(item.path).href` so the emitted URL respects the router's base and history mode. This is what makes a new-tab load land on the correct route.

### Decision 3: Suppress the press displacement at the sidebar container level with an important override

The base style applies `--tw-translate-y: 1px` via `active:not-aria-[haspopup]:translate-y-px`, whose `:not([aria-haspopup])` selector outranks a plain `active:translate-y-0`. To win reliably without editing the shared base, add a Tailwind v4 important override scoped to sidebar descendants on the desktop `<aside>` and the mobile drawer's nav container(s):

```
[&_button]:active:translate-y-0! [&_a]:active:translate-y-0!
```

This neutralizes the 1px shift for every `<button>` and `<a>` rendered inside the sidebar (covering both regular `Button`s and `as-child` anchors) in one place, leaving `transition-all` harmless (0→0). Buttons elsewhere keep the effect.

**Alternatives considered:**
- *Delete the class from the shared base.* Removes the effect globally — out of scope per the user's "sidebar only" choice.
- *Add `active:translate-y-0!` to each sidebar Button individually.* Works but repeats across ~8 instances; the container-level descendant override is DRY and centralized.
- *Non-important `active:not-aria-[haspopup]:translate-y-0` matching the base specificity.* Relies on Tailwind source-ordering to win — fragile. Important is deterministic.

## Risks / Trade-offs

- **`as-child` requires a single root child** → ensure all inner content (icon, label, requires-auth/admin badge spans) lives inside the `<a>`. Mitigation: move the existing children into the anchor unchanged.
- **Gated `<a>` has no `href` → weaker link semantics** → it behaves as an actionable control rather than a link. Mitigation: acceptable; the tooltip/badge already communicates the gated state, and a plain click still triggers the login prompt.
- **Important override is broad (`[&_a]`)** → also covers the GitHub link and account-menu trigger in the sidebar. Mitigation: harmless — they should not visibly shift either, and the account trigger (`aria-haspopup`) was already exempt from the base effect.
- **Middle-click on an accessible item triggers a full page load in the new tab** (not SPA) → expected and correct for "open in new tab".

## Migration Plan

Frontend-only, no data or API impact. Changes are picked up by Vite HMR. Rollback = revert the `App.vue` edits; no migration or cleanup needed.
