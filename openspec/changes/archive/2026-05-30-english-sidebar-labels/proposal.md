## Why

The sidebar mixes Chinese and English labels (论文管理 / 会议 / 标签管理 / 服务管理 / 设置 alongside Q&A / Notes / Idea Forge), which looks inconsistent. Unifying every sidebar-rendered label to concise English nouns gives the navigation one coherent voice and matches the existing English feature names.

## What Changes

- Translate the five Chinese top-level navigation labels to concise English nouns, keeping the already-English ones unchanged:
  - 论文管理 → **Papers**
  - 会议 → **Conferences**
  - 标签管理 → **Tags**
  - 服务管理 → **Services**
  - 设置 → **Settings**
  - (Q&A, Notes, Idea Forge unchanged)
- Translate the browser-tab page titles that mirror these labels (router `meta.title`), including detail-page placeholders: 论文详情 → **Paper Detail**, 会议详情 → **Conference Detail**.
- Translate all remaining sidebar-rendered auxiliary text so the sidebar is 100% English:
  - Tooltip / mobile gating suffixes: （需管理员）/ 需管理员 → **Admin only**, （需登录）/ 需登录 → **Login required**
  - Account area: 登录 → **Login**, 登出 → **Logout**, 账户设置 → **Account settings**, （管理员）badge → **Admin**
  - Sidebar-triggered toasts: 需要管理员权限 → **Admin access required**, 已登出 → **Logged out**
- No behavioral or layout changes — only the displayed strings change. Dynamic titles (paper title, conference name, Idea Forge project name) are already content-driven and unaffected.

Out of scope: the internal text of the LoginDialog and AccountDialog components (they are separate dialog components, not part of the sidebar). They can be handled in a follow-up if desired.

## Capabilities

### New Capabilities
<!-- None — this change only modifies the displayed strings of existing capabilities. -->

### Modified Capabilities
- `responsive-nav`: the navigation item labels, account-menu entries, login/logout entries, and gating tooltip/suffix text change from Chinese to English.
- `page-title`: the static page titles and detail-page placeholder titles change from Chinese to English.

## Impact

- Frontend only. No backend, API, or schema changes.
- `packages/frontend/src/App.vue` — `navItems` labels and all sidebar/drawer auxiliary strings (tooltips, account menu, login/logout, gating toasts).
- `packages/frontend/src/router/index.ts` — `meta.title` for each top-level route and the detail-page placeholders.
- Docs: `docs/frontend-architecture.md` if it documents nav labels or page titles.
