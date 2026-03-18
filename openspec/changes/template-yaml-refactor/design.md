## Context

当前模板系统将每个 QA 模板存为 `templates/` 目录下的独立 `.md` 文件（abstract.md、method.md、experiment.md），每个文件包含完整 prompt 和 `{{content}}` 占位符。prompt 拼接逻辑硬编码在 `qa_service.ts` 中：如果 prompt 包含 `{{content}}` 则替换，否则拼接 `"论文内容：\n" + content`。前端模板展示顺序依赖文件系统的 `readdirSync` 返回顺序。

## Goals / Non-Goals

**Goals:**
- 将所有模板配置统一到单一 `template.yml` 文件
- 支持可配置的系统 prompt 模板（论文内容与问题的拼接方式）
- QA 列表的顺序在配置中显式定义，前端按此顺序展示
- 保持 API 接口兼容（`/api/templates`、`/api/papers/:id/qa/template` 等）

**Non-Goals:**
- 不改变数据库 schema（qa_entries、qa_results 表结构不变）
- 不改变 free QA 的功能
- 不改变 QA 服务的模型调用逻辑（callOpenAI、callCLI）
- 不将 template.yml 合并到 config.yml 中（保持独立文件）

## Decisions

### 1. template.yml 文件格式

```yaml
# 系统 prompt 模板，定义论文内容和问题的拼接方式
# {PAPER} — 论文内容占位符
# {PROMPT} — 问题占位符
system_prompt: |
  请根据以下论文内容回答问题。

  论文内容：
  {PAPER}

  问题：
  {PROMPT}

# QA 模板列表，顺序决定前端展示顺序
qa:
  - name: abstract
    prompt: "用中文总结这篇论文的核心内容和主要贡献（200-300字）。"
  - name: method
    prompt: "用中文详细描述这篇论文提出的方法和技术方案（200-400字）。"
  - name: experiment
    prompt: "用中文总结这篇论文的实验设计、数据集和实验结果（200-400字）。"
```

**理由**: QA 的 prompt 现在只包含问题本身，不再包含论文内容——论文内容的拼接统一由 `system_prompt` 模板处理。这样做的好处：
- 问题和论文内容的拼接方式可以全局配置，修改一处即生效
- 每个 QA prompt 更简洁，只关注"问什么"
- `{PAPER}` 和 `{PROMPT}` 占位符语义清晰

### 2. template_loader.ts 改为解析 YAML

使用 `js-yaml` 解析 `template.yml`。导出接口保持兼容：
- `loadTemplates()` → 返回 QA 列表（有序数组）
- `loadTemplate(name)` → 按名称查找
- 新增 `loadSystemPrompt()` → 返回系统 prompt 模板字符串

### 3. qa_service.ts 使用系统 prompt 模板拼接

`askQuestion()` 中的 prompt 拼接逻辑改为：
1. 从 `template_loader` 获取 `system_prompt` 模板
2. 将 `{PAPER}` 替换为论文内容，`{PROMPT}` 替换为当前问题
3. 对于 free QA 同样使用此模板（统一拼接方式）

### 4. API `/api/templates` 返回有序数组

当前已返回数组，保持不变。前端也已经按数组顺序渲染，因此排序逻辑自然由 `template.yml` 中 `qa` 列表的顺序决定。

### 5. 不使用 config.yml

template.yml 保持为独立文件，不合并到 config.yml。理由：
- 模板内容较多（含多行 prompt），放入 config.yml 会让配置文件过于臃肿
- 职责分离：config.yml 管系统配置，template.yml 管 QA 模板

## Risks / Trade-offs

- **[Breaking] 占位符变更**: 旧模板用 `{{content}}`，新模板用 `{PAPER}` + `{PROMPT}` → 迁移时需确保所有引用更新。qa_results 表中已保存的旧 prompt 不受影响（历史数据保持原样）。
- **[依赖] js-yaml**: 需要新增 `js-yaml` 依赖 → Bun 完全兼容此包，风险低。
- **[验证] YAML 格式错误**: template.yml 格式错误会导致模板加载失败 → 在 `template_loader.ts` 中添加启动时验证和清晰的错误提示。
