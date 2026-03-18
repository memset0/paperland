## 1. Backend — papers_cool_service

- [x] 1.1 创建 `packages/backend/src/services/papers_cool_service.ts`，实现 PaperBoundServiceDef（depends_on: ['arxiv_id'], produces: ['papers_cool_summary']）
- [x] 1.2 实现 HTML 抓取逻辑：fetch `https://papers.cool/arxiv/kimi?paper={arxiv_id}`，从 HTML 中提取 markdown 内容
- [x] 1.3 在 `packages/backend/src/services/` 入口处注册 papers_cool_service 到 ServiceRunner

## 2. 配置

- [x] 2.1 在 config.yml 和 config.example.yml 中添加 `papers_cool` 服务配置（max_concurrency: 1, rate_limit_interval: 5）
- [x] 2.2 更新 config.ts 的 Zod schema，支持 papers_cool 配置项（如果需要）

## 3. Frontend — 中文摘要展示（折叠 + 渐变遮罩）

- [x] 3.1 在 PaperDetail.vue 的 QA 列表上方添加「中文摘要」区域，使用 MarkdownContent 组件渲染 markdown，仅当 metadata.papers_cool_summary 存在时显示
- [x] 3.2 实现折叠交互：默认 max-height 限制只显示前几行，底部白色渐变遮罩（gradient overlay），点击展开全文/收起
- [x] 3.3 自动检测内容高度：内容未超过 max-height 时不显示遮罩和展开按钮

## 4. 文档更新

- [x] 4.1 更新 docs/ 中相关架构文档，记录新增的 papers_cool 服务

## 5. Frontend — FAQ Panel 重构

- [x] 5.1 将卡片标题改为「Kimi 自动摘要 (papers.cool)」，其中 papers.cool 为可点击链接跳转到 `https://papers.cool/arxiv/{arxiv_id}`
- [x] 5.2 将 markdown 内容按 `Q\d+:` 分割为独立 FAQ 条目，每条提取问题和答案
- [x] 5.3 每个 FAQ 条目渲染为可折叠 panel（默认折叠，点击展开/收起），去掉整体渐变遮罩模式
