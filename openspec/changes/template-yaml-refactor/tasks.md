## 1. 创建 template.yml 配置文件

- [ ] 1.1 在项目根目录创建 `template.yml`，包含 `system_prompt`（使用 `{PAPER}` 和 `{PROMPT}` 占位符的多行字符串）和 `qa` 列表（abstract、method、experiment，每项含 name 和 prompt）
- [ ] 1.2 在 backend 添加 `js-yaml` 依赖（`bun add js-yaml @types/js-yaml --filter @paperland/backend`）

## 2. 重构 template_loader.ts

- [ ] 2.1 重写 `template_loader.ts`：解析 `template.yml`，导出 `loadTemplates()` 返回有序 `{name, prompt}` 数组、`loadTemplate(name)` 按名称查找、`getSystemPrompt()` 返回系统 prompt 模板字符串
- [ ] 2.2 添加启动时校验：缺失或格式错误时 log 错误并返回空列表（graceful degradation）

## 3. 重构 qa_service.ts

- [ ] 3.1 修改 `askQuestion()` 中的 prompt 拼接逻辑：使用 `getSystemPrompt()` 获取模板，将 `{PAPER}` 替换为论文内容、`{PROMPT}` 替换为问题，统一用于 template QA 和 free QA

## 4. 适配 API 层

- [ ] 4.1 更新 `api/qa.ts`：`loadTemplates()` 返回的字段从 `{name, content}` 改为 `{name, prompt}`，确保 `/api/templates` 返回有序列表（只返回 name）
- [ ] 4.2 更新 `api/qa.ts` 中模板 QA 触发和重新生成逻辑：使用 `tmpl.prompt` 替代 `tmpl.content`
- [ ] 4.3 更新 `external-api/papers.ts` 中自动模板 QA 逻辑（如涉及 template 加载）

## 5. 清理与迁移

- [ ] 5.1 删除 `templates/` 目录及其下的 `.md` 文件（abstract.md、method.md、experiment.md）

## 6. 文档更新

- [ ] 6.1 更新 `docs/frontend-architecture.md` 和 `docs/tech-stack.md`，反映模板系统从 filesystem `.md` 文件迁移到 `template.yml` 的变更
- [ ] 6.2 更新 `CLAUDE.md` 中关于模板的说明（从 "`.md` files in `templates/` directory, managed via filesystem only" 改为 `template.yml`）
