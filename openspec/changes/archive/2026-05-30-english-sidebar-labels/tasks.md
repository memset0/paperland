## 1. Navigation labels (App.vue)

- [x] 1.1 In `packages/frontend/src/App.vue`, update the `navItems` array labels: 论文管理 → `Papers`, 会议 → `Conferences`, 标签管理 → `Tags`, 服务管理 → `Services`, 设置 → `Settings` (leave Q&A, Notes, Idea Forge unchanged)

## 2. Sidebar auxiliary text (App.vue)

- [x] 2.1 Desktop tooltip gating suffixes: （需管理员）→ `Admin only`, （需登录）→ `Login required`
- [x] 2.2 Mobile drawer gating suffixes: 需管理员 → `Admin only`, 需登录 → `Login required`
- [x] 2.3 Login entries (desktop tooltip + mobile button): 登录 → `Login`
- [x] 2.4 Account menu: 账户设置 → `Account settings`, 登出 → `Logout`, and the （管理员）badge → `Admin`
- [x] 2.5 Mobile logout button: 登出 → `Logout`
- [x] 2.6 Sidebar-triggered toasts: `toast.error('需要管理员权限')` → `Admin access required`, `toast.success('已登出')` → `Logged out`

## 3. Page titles (router/index.ts)

- [x] 3.1 In `packages/frontend/src/router/index.ts`, update each top-level route `meta.title` to match the new nav labels: 论文管理 → `Papers`, 会议 → `Conferences`, 标签管理 → `Tags`, 服务管理 → `Services`, 设置 → `Settings` (Q&A, Notes, Idea Forge unchanged)
- [x] 3.2 Update detail-page placeholder titles: 论文详情 → `Paper Detail`, 会议详情 → `Conference Detail`

## 4. Verification

- [x] 4.1 Grep `App.vue` for CJK characters in the sidebar/drawer markup to confirm no Chinese sidebar strings remain (dynamic values like `auth.user?.username` and `Paperland` are unaffected)
- [x] 4.2 Run the frontend (`bun run dev`) and visually confirm: desktop tooltips, mobile drawer, account menu, login/logout, and browser-tab titles all read in English; gating still prompts/blocks as before
- [x] 4.3 Update `docs/frontend-architecture.md` if it documents the sidebar nav labels or page titles
