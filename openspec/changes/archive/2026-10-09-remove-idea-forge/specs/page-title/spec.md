## MODIFIED Requirements

### Requirement: Static page titles
每个顶层导航页面 SHALL 拥有与其侧边栏标签语义一致的固定标题（标题均为英文）：论文列表（`/`）→ `Papers`，标签管理（`/tags`）→ `Tags`，Q&A（`/qa`）→ `Q&A`，服务管理（`/services`）→ `Services`，设置（`/settings`）→ `Settings`。

#### Scenario: Open paper list
- **WHEN** 用户打开 `/`
- **THEN** `document.title` SHALL 为 `Papers · Paperland`

#### Scenario: Open settings
- **WHEN** 用户打开 `/settings`
- **THEN** `document.title` SHALL 为 `Settings · Paperland`

#### Scenario: Open Q&A page
- **WHEN** 用户打开 `/qa`
- **THEN** `document.title` SHALL 为 `Q&A · Paperland`

### Requirement: Title resets when leaving a dynamic page
当用户从动态页面（如论文详情）导航到其他页面时，`document.title` SHALL 更新为目标页面的标题，且 SHALL NOT 残留上一页面的内容标题。

#### Scenario: Leave paper detail
- **WHEN** 用户从某论文详情页导航到 `/settings`
- **THEN** `document.title` SHALL 为 `Settings · Paperland`，不再包含上一篇论文的标题

## REMOVED Requirements

### Requirement: Idea Forge project title from project name
**Reason**: Idea Forge 功能已整体移除，项目页不再存在。
**Migration**: 无；论文详情等其余动态标题行为不变。
