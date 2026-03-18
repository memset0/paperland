## Context

当前模板系统将每个 QA 模板存为 `templates/` 目录下的独立 `.md` 文件（abstract.md、method.md、experiment.md），每个文件包含完整 prompt 和 `{{content}}` 占位符。prompt 拼接逻辑硬编码在 `qa_service.ts` 中：如果 prompt 包含 `{{content}}` 则替换，否则拼接 `"论文内容：\n" + content`。前端模板展示顺序依赖文件系统的 `readdirSync` 返回顺序。

`config.yml` 已经是项目的统一配置中心，通过 Zod 验证 + `AppConfig` 类型管理。现已有 `js-yaml` 依赖。

## Goals / Non-Goals

**Goals:**
- 将模板配置直接追加到 `config.yml`，作为两个新的顶层字段
- 支持可配置的系统 prompt 模板（论文内容与问题的拼接方式）
- QA 列表的顺序在配置中显式定义，前端按此顺序展示
- 保持 API 接口兼容（`/api/templates`、`/api/papers/:id/qa/template` 等）

**Non-Goals:**
- 不改变数据库 schema（qa_entries、qa_results 表结构不变）
- 不改变 free QA 的功能
- 不改变 QA 服务的模型调用逻辑（callOpenAI、callCLI）
- 不创建独立的 template.yml 文件

## Decisions

### 1. config.yml 中追加的字段格式

```yaml
# ... 现有 config.yml 内容 ...

system_prompt: |
  请根据以下论文内容回答问题。

  论文内容：
  {PAPER}

  问题：
  {PROMPT}

qa:
  - name: abstract
    prompt: "用中文总结这篇论文的核心内容和主要贡献（200-300字）。"
  - name: method
    prompt: "用中文详细描述这篇论文提出的方法和技术方案（200-400字）。"
  - name: experiment
    prompt: "用中文总结这篇论文的实验设计、数据集和实验结果（200-400字）。"
```

**理由**: 直接追加到 config.yml，与其他配置统一管理，无需新增文件。`system_prompt` 定义拼接方式，`qa` 数组定义问题列表及顺序。

### 2. 类型和验证扩展

在 `packages/shared/src/types.ts` 的 `AppConfig` 接口中新增：
```typescript
system_prompt: string
qa: Array<{ name: string; prompt: string }>
```

在 `packages/backend/src/config.ts` 的 Zod schema 中新增：
```typescript
system_prompt: z.string(),
qa: z.array(z.object({ name: z.string(), prompt: z.string() })).min(1),
```

### 3. template_loader.ts 简化为从 config 读取

不再读文件系统，改为从 `getConfig()` 获取数据：
- `loadTemplates()` → `getConfig().qa`（有序数组）
- `loadTemplate(name)` → 从 `getConfig().qa` 中 find
- `getSystemPrompt()` → `getConfig().system_prompt`

### 4. qa_service.ts 使用系统 prompt 模板拼接

`askQuestion()` 中的 prompt 拼接逻辑改为：
1. 从 config 获取 `system_prompt`
2. 将 `{PAPER}` 替换为论文内容，`{PROMPT}` 替换为当前问题
3. template QA 和 free QA 统一使用此拼接方式

### 5. API 层适配

`/api/templates` 和模板触发/重新生成 endpoint 中，将 `tmpl.content` 改为 `tmpl.prompt`。接口响应格式不变。

## Risks / Trade-offs

- **[Breaking] 占位符变更**: 旧模板用 `{{content}}`，新逻辑用 `{PAPER}` + `{PROMPT}` → 迁移时需确保所有引用更新。qa_results 表中已保存的旧 prompt 不受影响（历史数据保持原样）。
- **[Config 耦合]**: 模板内容放入 config.yml 增加了配置文件的体积 → 可接受，当前 QA 数量少且 prompt 不长。
- **[验证]**: Zod 会在启动时验证 `system_prompt` 和 `qa` 字段，格式错误会阻止启动 → 与现有 config 验证行为一致。
