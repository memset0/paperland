## ADDED Requirements

### Requirement: Papers Cool Service Definition
系统 SHALL 提供名为 `papers_cool` 的 paper-bound 服务，声明 `depends_on: ['arxiv_id']` 和 `produces: ['papers_cool_summary']`。

#### Scenario: Service registered in dependency graph
- **WHEN** 系统启动并注册所有服务
- **THEN** papers_cool 服务 SHALL 出现在 ServiceRunner 的已注册服务列表中，类型为 paper_bound

#### Scenario: Service triggered after arxiv_id available
- **WHEN** 一篇论文的 arxiv_id 已存在
- **THEN** ServiceRunner SHALL 将 papers_cool 服务纳入执行计划

#### Scenario: Service skipped when summary exists
- **WHEN** 论文的 metadata 中已存在 papers_cool_summary 键
- **THEN** ServiceRunner SHALL 跳过 papers_cool 服务

### Requirement: Fetch Chinese Summary from papers.cool
服务 SHALL 根据论文的 arxiv_id 从 `https://papers.cool/arxiv/kimi?paper={arxiv_id}` 抓取页面内容，提取其中的 markdown 格式中文论文分析。

#### Scenario: Successful fetch
- **WHEN** 服务对一篇有效的 arxiv_id 执行
- **THEN** 服务 SHALL 返回 `{ papers_cool_summary: "<markdown content>" }`，ServiceRunner 将其自动存入 metadata

#### Scenario: Page not found or empty
- **WHEN** papers.cool 对该 arxiv_id 返回无内容或 HTTP 错误
- **THEN** 服务 SHALL 抛出错误，ServiceRunner 将执行标记为 failed

#### Scenario: Network error
- **WHEN** 网络请求失败（超时、DNS 等）
- **THEN** 服务 SHALL 抛出错误，包含明确的错误信息

### Requirement: Service Concurrency Configuration
config.yml SHALL 包含 `papers_cool` 服务配置项，支持 `max_concurrency` 和 `rate_limit_interval` 设置。

#### Scenario: Config with rate limiting
- **WHEN** config.yml 中设置 `papers_cool.max_concurrency: 1` 和 `papers_cool.rate_limit_interval: 5`
- **THEN** ServiceRunner SHALL 限制最多 1 个并发执行，且每次执行间隔至少 5 秒

### Requirement: Frontend Summary Display
前端论文详情页 SHALL 在论文 metadata 包含 papers_cool_summary 时，在 QA 列表上方展示该内容。内容默认折叠，仅显示前几行，超出部分用白色渐变遮罩覆盖，点击可展开全文。

#### Scenario: Summary available — collapsed by default
- **WHEN** 论文的 metadata.papers_cool_summary 有值
- **THEN** 前端 SHALL 在 QA 列表上方显示「中文摘要」区域，默认只显示前几行（max-height 限制），底部覆盖白色渐变遮罩（从 transparent 到 white），并显示展开按钮

#### Scenario: Click to expand
- **WHEN** 用户点击渐变遮罩区域或展开按钮
- **THEN** 前端 SHALL 移除 max-height 限制和渐变遮罩，显示完整 markdown 内容，按钮变为「收起」

#### Scenario: Click to collapse
- **WHEN** 用户点击「收起」按钮
- **THEN** 前端 SHALL 恢复 max-height 限制和渐变遮罩

#### Scenario: Summary not available
- **WHEN** 论文的 metadata 中不存在 papers_cool_summary
- **THEN** 前端 SHALL 不显示中文摘要区域

#### Scenario: Content shorter than max-height
- **WHEN** papers_cool_summary 内容较短，不超过 max-height 限制
- **THEN** 前端 SHALL 直接显示完整内容，不显示渐变遮罩和展开按钮
