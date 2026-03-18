## Context

系统已有 arxiv_service、semantic_scholar_service、pdf_parse_service 三个 paper-bound 服务，通过 depends_on/produces 依赖图自动调度。papers.cool 提供基于 Kimi 的中文论文分析（Q1-Q7 问答格式，markdown），可通过 `https://papers.cool/arxiv/kimi?paper={arxiv_id}` 直接获取。

ServiceRunner 中，服务返回的非特殊键（非 title/abstract/authors/arxiv_id/corpus_id/pdf_path，非 contents.* 前缀）会自动存入 `metadata` JSON 字段。因此服务返回 `{ papers_cool_summary: markdownString }` 即可自动存入 `metadata.papers_cool_summary`。

## Goals / Non-Goals

**Goals:**
- 新增 papers_cool_service，自动抓取中文论文摘要
- 抓取结果存入 `metadata.papers_cool_summary`
- 前端论文详情页展示抓取的中文摘要（markdown 渲染）
- 服务纳入依赖图，添加论文时自动触发

**Non-Goals:**
- 不支持自定义 papers.cool 的 URL 模板
- 不解析页面中的 LaTeX 公式（保留原始 markdown 即可）
- 不将摘要用于 QA content_priority
- 不做缓存/增量更新——已有 `produces` 机制会跳过已完成的服务

## Decisions

### 1. 使用 metadata 而非 contents 存储

**决定**: 返回 `papers_cool_summary` 键，由 ServiceRunner 自动存入 metadata。

**理由**: 用户明确此数据仅作展示，不参与 QA 的 content_priority 选择。metadata 是存放此类辅助信息的正确位置。

**备选方案**: `contents.papers_cool` — 可参与 QA，但用户不需要。

### 2. 抓取方式：直接 fetch HTML 后提取 markdown

**决定**: 使用 Bun 内置 fetch 获取页面 HTML，提取主体内容区域的 markdown 文本。

**理由**:
- papers.cool 页面结构简单，主体内容在特定 HTML 元素中
- 页面内容本身就是 markdown 格式（带少量 HTML 标签）
- 无需 headless browser，fetch + 简单解析即可

### 3. produces 声明为 `papers_cool_summary`

**决定**: `produces: ['papers_cool_summary']`，ServiceRunner 的 `getExistingKeys` 已支持检查 metadata 中的键。

**理由**: 这样依赖图可以正确判断服务是否已完成（metadata 中存在该键即跳过）。

### 4. 服务配置键名使用 `papers_cool`

**决定**: config.yml 中使用 `papers_cool` 作为服务配置键名（与 service_runner 中 semaphore/rate limiter 的查找一致）。

**注意**: service_runner 按 `def.name` 查找配置，而非任意键。需确保 `name: 'papers_cool'` 与 config 键匹配。实际上看 service_runner 代码，`initialize()` 遍历 `config.services` 的键来创建 semaphore/rate limiter，而 `register()` 按 `def.name` 设置默认值。所以 config 键应为 `papers_cool`，service name 也应为 `papers_cool`。

### 5. 前端展示：折叠 + 渐变遮罩模式

**决定**: 中文摘要区域放在 QA 列表上方，默认折叠（max-height 限制），底部覆盖白色渐变遮罩（gradient from transparent to white），点击展开/收起。

**理由**:
- papers.cool 的摘要内容较长（Q1-Q7 共 7 个问答），全部展开会挤占 QA 区域
- 渐变遮罩是常见的 "read more" 交互模式，直觉且美观
- 内容较短时自动检测（scrollHeight <= maxHeight），不显示遮罩和按钮

**实现方式**:
- 使用 `overflow: hidden` + `max-height` 控制折叠高度
- CSS gradient overlay（`::after` 伪元素或绝对定位 div）
- 使用 ref 检测内容实际高度，决定是否显示展开按钮
- 复用现有 `MarkdownContent.vue` 组件渲染 markdown

## Risks / Trade-offs

- **papers.cool 页面结构变化** → HTML 解析逻辑可能失效。缓解：解析逻辑保持简单，抛出明确错误。
- **papers.cool 限流/封禁** → 设置合理的 rate_limit_interval（建议 5 秒）和 max_concurrency: 1。
- **部分论文无 Kimi 分析** → 页面可能返回空内容或错误。服务应优雅处理，返回空结果而非抛错。
