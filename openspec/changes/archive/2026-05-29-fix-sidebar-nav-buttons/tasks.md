## 1. Navigation handler (App.vue script)

- [x] 1.1 Add a `navHref(item)` helper returning `router.resolve(item.path).href` for accessible items and `undefined` for gated items (login-required while anonymous, or admin-only for a non-admin).
- [x] 1.2 Replace `go(item)` with `onNavClick(e, item)`: when the item is accessible and a modifier key is held (`metaKey || ctrlKey || shiftKey || altKey`), `return` without `preventDefault()`; otherwise `preventDefault()`, run the existing admin/login gating, then close the drawer and `router.push(item.path)` when the path differs.

## 2. Desktop sidebar links (App.vue template)

- [x] 2.1 Convert each desktop nav `Button` to `Button as-child` wrapping `<a :href="navHref(item)" @click="onNavClick($event, item)">`, with the icon inside the anchor; keep the existing `variant`, `size`, and active-state class.

## 3. Mobile drawer links (App.vue template)

- [x] 3.1 Convert each mobile drawer nav `Button` to `Button as-child` wrapping `<a :href="navHref(item)" @click="onNavClick($event, item)">`, keeping the icon, label, and the requires-auth/admin badge spans inside the anchor.

## 4. Remove press displacement on the sidebar

- [x] 4.1 Add the important override `[&_button]:active:translate-y-0! [&_a]:active:translate-y-0!` to the desktop `<aside>` and the mobile drawer's nav container(s) so sidebar buttons/anchors do not shift on press; confirm the shared `Button` base style in `components/ui/button/index.ts` is left unchanged.

## 5. Verify & document

- [x] 5.1 In the running app: ctrl/cmd-click and middle-click an accessible nav item opens a new tab (current tab unchanged); a plain click still navigates in-app and closes the mobile drawer; a gated item still prompts login / requires-admin on plain click and opens no new tab on modifier/middle-click.
- [x] 5.2 Confirm sidebar nav buttons no longer shift on press, while a non-sidebar button still shows its press effect.
- [x] 5.3 Update `docs/frontend-architecture.md` to describe the link-based sidebar navigation (new-tab support + gating) and the sidebar-scoped no-press-displacement override.
