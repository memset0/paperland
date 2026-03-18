## 1. 扩展 config.yml 和类型系统

- [x] 1.1 在 `config.yml` 末尾追加 `system_prompt`（多行字符串，含 `{PAPER}` 和 `{PROMPT}` 占位符）和 `qa` 列表（abstract、method、experiment，每项含 name 和 prompt）
- [x] 1.2 在 `packages/shared/src/types.ts` 的 `AppConfig` 接口中新增 `system_prompt: string` 和 `qa: Array<{ name: string; prompt: string }>` 字段
- [x] 1.3 在 `packages/backend/src/config.ts` 的 Zod configSchema 中新增 `system_prompt` 和 `qa` 字段验证

## 2. 重构 template_loader.ts

- [x] 2.1 重写 `template_loader.ts`：从 `getConfig()` 读取，导出 `loadTemplates()` 返回有序 `{name, prompt}` 数组、`loadTemplate(name)` 按名称查找、`getSystemPrompt()` 返回系统 prompt 模板字符串；移除文件系统读取逻辑

## 3. 重构 qa_service.ts

- [x] 3.1 修改 `askQuestion()` 中的 prompt 拼接逻辑：使用 `getSystemPrompt()` 获取模板，将 `{PAPER}` 替换为论文内容、`{PROMPT}` 替换为问题，统一用于 template QA 和 free QA

## 4. 适配 API 层

- [x] 4.1 更新 `api/qa.ts`：适配 `loadTemplates()` 返回的新字段（`prompt` 代替 `content`），确保 `/api/templates` 返回有序列表、模板触发和重新生成使用 `tmpl.prompt`
- [x] 4.2 检查并更新 `external-api/papers.ts` 中自动模板 QA 逻辑（如涉及 template 加载）

## 5. 清理与迁移

- [x] 5.1 删除 `templates/` 目录及其下的 `.md` 文件（abstract.md、method.md、experiment.md）

## 6. 文档更新

- [x] 6.1 更新 `docs/frontend-architecture.md` 和 `docs/tech-stack.md`，反映模板系统从 filesystem `.md` 文件迁移到 `config.yml` 的变更
- [x] 6.2 更新 `CLAUDE.md` 中关于模板的说明（从 "`.md` files in `templates/` directory, managed via filesystem only" 改为 `config.yml` 中的 `system_prompt` 和 `qa` 字段）
