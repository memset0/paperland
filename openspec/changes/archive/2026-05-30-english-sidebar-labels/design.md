## Context

The sidebar navigation is defined once in a `navItems` array in `packages/frontend/src/App.vue` and rendered in two places (the desktop icon sidebar with hover tooltips, and the mobile drawer). The same labels are mirrored as `meta.title` on each route in `packages/frontend/src/router/index.ts`, which a `usePageTitle()` composable turns into `{title} · Paperland` browser-tab titles. There is no i18n framework — all labels are hardcoded strings. Today five top-level labels are Chinese while three (Q&A, Notes, Idea Forge) are English, plus assorted Chinese auxiliary strings (tooltip suffixes, account menu, login/logout, gating toasts). This change makes every sidebar-rendered string English.

## Goals / Non-Goals

**Goals:**
- One consistent English voice for every string rendered inside the desktop sidebar and mobile drawer.
- Browser-tab titles stay in sync with the new nav labels.
- Zero behavioral, layout, routing, or gating changes — only displayed text changes.

**Non-Goals:**
- Adding an i18n / localization framework (labels remain hardcoded).
- Translating the LoginDialog / AccountDialog internals or any non-sidebar page content.
- Changing dynamic content-driven titles (paper title, conference name, Idea Forge project name) — already non-Chinese and untouched.

## Decisions

**Decision: Concise English nouns, matching the existing English labels.**
The existing English nav items (Q&A, Notes, Idea Forge) are short nouns, so the translated labels follow the same style rather than verbose "… Management" phrases. Final glossary:

| Location | Chinese | English |
|---|---|---|
| nav label `/` | 论文管理 | Papers |
| nav label `/conferences` | 会议 | Conferences |
| nav label `/tags` | 标签管理 | Tags |
| nav label `/services` | 服务管理 | Services |
| nav label `/settings` | 设置 | Settings |
| route title `/papers/:id` | 论文详情 | Paper Detail |
| route title `/conferences/:id` | 会议详情 | Conference Detail |
| tooltip / mobile suffix | （需管理员）/ 需管理员 | Admin only |
| tooltip / mobile suffix | （需登录）/ 需登录 | Login required |
| account / mobile button | 登录 | Login |
| account / mobile button | 登出 | Logout |
| account menu item | 账户设置 | Account settings |
| account badge | （管理员） | Admin |
| gating toast | 需要管理员权限 | Admin access required |
| logout toast | 已登出 | Logged out |

_Rationale:_ "Papers"/"Tags"/"Services"/"Settings" read naturally as section names and stay short enough for the single-line hover tooltip; the verbose alternative ("Paper Management", etc.) was rejected as inconsistent with Notes/Q&A.

**Decision: Keep labels hardcoded; edit the two source-of-truth files.**
`navItems` in `App.vue` and `meta.title` in `router/index.ts` are the only two places these strings live, so a direct string edit in both is sufficient. No i18n layer is introduced because there is no second-language requirement.

**Decision: The nav label and the route `meta.title` for a given top-level page use the same English string.**
They are conceptually the same name (sidebar entry ↔ tab title), so they are kept identical (e.g. both "Papers"), preserving the existing mirror relationship.

## Risks / Trade-offs

- [Stale spec wording] The `responsive-nav` spec's scenarios reference Chinese labels (and call Notes "笔记", which the code already shows as "Notes") and omit Conferences. → The delta spec updates these scenarios to the actual English label set so the spec matches shipped behavior.
- [Missed string] A sidebar string could be overlooked. → Tasks include a final grep of `App.vue` for CJK characters to confirm none remain in sidebar/drawer markup.
- [Out-of-scope inconsistency] Translating the account menu's "Account settings" entry while the AccountDialog it opens stays Chinese is a minor seam. → Accepted; flagged as an optional follow-up in the proposal.
