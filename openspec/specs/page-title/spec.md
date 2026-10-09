# page-title Specification

## Purpose
TBD - created by archiving change add-page-title. Update Purpose after archive.

## Requirements

### Requirement: Per-page browser title
应用 SHALL 根据当前显示的页面内容设置浏览器标签标题（`document.title`），而非对所有页面使用同一个固定标题。

#### Scenario: Navigating between pages
- **WHEN** 用户从一个页面导航到另一个页面
- **THEN** `document.title` SHALL 更新为能标识新页面的标题

### Requirement: Title format and fallback
页面标题 SHALL 使用 `{页面标题} · Paperland` 的格式。当某页面没有特定标题时，`document.title` SHALL 回退为 `Paperland`。

#### Scenario: Page with specific title
- **WHEN** 某页面将其标题定义为 `Papers`
- **THEN** `document.title` SHALL 为 `Papers · Paperland`

#### Scenario: Page without specific title
- **WHEN** 某页面没有定义特定标题
- **THEN** `document.title` SHALL 为 `Paperland`

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

### Requirement: Paper detail title from paper title
论文详情页（`/papers/:id`）SHALL 在论文数据加载完成后，将页面标题设置为该论文的标题。在论文数据可用之前，SHALL 显示占位标题 `Paper Detail`。论文标题在页面内被修改后，页面标题 SHALL 同步更新。

#### Scenario: Paper loaded
- **WHEN** 论文详情页加载完成，论文标题为 `Attention Is All You Need`
- **THEN** `document.title` SHALL 为 `Attention Is All You Need · Paperland`

#### Scenario: Paper still loading
- **WHEN** 论文详情页已打开但论文数据尚未加载完成
- **THEN** `document.title` SHALL 为 `Paper Detail · Paperland`

### Requirement: Title resets when leaving a dynamic page
当用户从动态页面（如论文详情）导航到其他页面时，`document.title` SHALL 更新为目标页面的标题，且 SHALL NOT 残留上一页面的内容标题。

#### Scenario: Leave paper detail
- **WHEN** 用户从某论文详情页导航到 `/settings`
- **THEN** `document.title` SHALL 为 `Settings · Paperland`，不再包含上一篇论文的标题
