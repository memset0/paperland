## Why

目前系统缺少论文的中文摘要/分析。papers.cool 网站提供了基于 Kimi 的中文论文分析（Q&A 格式），可以直接根据 arxiv_id 抓取，为用户提供快速的中文论文理解。

## What Changes

- 新增 `papers_cool_service` paper-bound 服务，根据 arxiv_id 从 `https://papers.cool/arxiv/kimi?paper={arxiv_id}` 抓取中文摘要
- 抓取的 markdown 内容存入 `metadata.papers_cool_summary`
- 在前端论文详情页展示 papers_cool_summary（渲染为 markdown）
- config.yml 中新增 `papers_cool` 服务配置（max_concurrency、rate_limit_interval）

## Capabilities

### New Capabilities
- `papers-cool-fetch`: 从 papers.cool 抓取中文论文摘要并存储到 metadata，在前端展示

### Modified Capabilities

_无需修改现有 spec 的需求。_

## Impact

- **后端**: 新增 `packages/backend/src/services/papers_cool_service.ts`
- **前端**: 论文详情页新增 papers_cool_summary 展示区域
- **配置**: config.yml 新增 `papers_cool` 服务项
- **共享类型**: 无需修改（metadata 已是 `Record<string, unknown>`）
- **依赖**: 无新外部依赖，使用内置 fetch API 抓取网页
