## Why

当前模板系统使用 `templates/` 目录下的独立 `.md` 文件管理 QA 模板，每个文件包含完整的 prompt（含 `{{content}}` 占位符）。这种方式存在几个问题：模板分散在多个文件中不便于统一管理；prompt 拼接逻辑（论文内容如何与问题组合）硬编码在 `qa_service.ts` 中无法配置；模板的展示顺序依赖文件系统读取顺序，不可控。

## What Changes

- **BREAKING**: 移除 `templates/` 目录下的 `.md` 模板文件，替换为根目录下的单一 `template.yml` 文件
- `template.yml` 包含两部分：
  1. **系统 prompt 模板** — 一个多行字符串，使用 `{PAPER}` 表示论文内容、`{PROMPT}` 表示问题，定义论文和问题的拼接方式
  2. **QA 列表** — 有序的问题数组，每个问题包含名称和 prompt 内容，顺序决定前端展示顺序
- 重构 `template_loader.ts`，从读取文件系统改为解析 `template.yml`
- 重构 `qa_service.ts` 中的 prompt 拼接逻辑，使用 `template.yml` 中定义的系统 prompt 模板
- 前端 TemplateQA 组件按 `template.yml` 中 QA 列表的顺序展示

## Capabilities

### New Capabilities
- `template-yaml-config`: 将模板配置统一到单一 `template.yml` 文件，包含系统 prompt 模板和有序 QA 列表

### Modified Capabilities

## Impact

- **Backend**: `template_loader.ts`（重写加载逻辑）、`qa_service.ts`（prompt 拼接逻辑）、`api/qa.ts`（模板列表 API 需返回有序列表）
- **Frontend**: `TemplateQA.vue`（按配置顺序展示）、`stores/qa.ts`（保持模板顺序）
- **Config**: 新增根目录 `template.yml`，移除 `templates/` 目录
- **External API**: `external-api/papers.ts` 中的自动模板 QA 逻辑需适配
- **Docs**: 需更新 `docs/frontend-architecture.md`、`docs/tech-stack.md`
