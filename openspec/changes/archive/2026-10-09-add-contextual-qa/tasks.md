## 0. Gate

- [x] 0.1 与用户讨论并定稿 design.md 的 Open Questions，补齐 Modified Capabilities 的 delta specs
- [x] 0.2 用户明确允许进入实现（2026-10-09）
- [x] 0.3 确认 `add-qa-all-users-scope`、`unify-multiuser-visibility` 已归档
- [x] 0.4 确认 `add-doc2x-parse-translate` 不会再大改 `qa_service.ts`、`config.ts`、`shared/types.ts`（用户 2026-10-09 确认；其改动仍未提交，在其磁盘版本上叠加修改）

## 1. Config & data model

- [x] 1.1 `prompts/system/paper-qa.md`；`config.ts`：`qa_prompt`（`system_prompts_dir`、`default_system_prompt`、`direct_ask.{system_prompt,question}`）、启动时校验引用的文件存在、运行时读文件、预设问题可选 `system_prompt`、引用名校验、移除顶层 `system_prompt`（迁移提示）、模型 `vision` 能力；`config.example.yml` 与 `config.yml`
- [x] 1.2 `qa_results` 增加 `deleted_at`（软删除）；新表 `qa_result_cites`（列表外 `#cite:` id）；`qa_entries` 增加 `instruction`/`inputs`（含 history）/派生 `parent_entry_id` + Drizzle migration（先备份）；shared 类型

## 2. Model invocation

- [x] 2.1 `ModelInput` 结构化接口；OpenAI / Codex provider 映射文本、多轮与图片；字符串封装兼容旧调用方；provider 单测（mock）
- [x] 2.2 QA formatter（图片 → 选段 → 历史 → 问题；整条链输入只出现一次、历史只引用标号；后端分配链内唯一标号）：system prompt + 全文 + references + inputs + 沿 history.result_id 链回溯的历史（服务端内部读取，不做可见性过滤）；历史上限

## 3. API

- [x] 3.1 扩展 free 创建接口（instruction/inputs，含 history input；校验 vision、image input 必须引用图床已有图片（拒绝外部/data URL）、history 至多一个且创建时父 Result 对提问者可见）；列表/详情返回新字段；树读取
- [x] 3.3 删除接口改为软删除，所有读取排除已删除行；prompt 组装仍读取
- [x] 3.4 `paperland://paper/<pid>?qa=<id>[&result=]` 解析：只按 entry 定位实际论文，忽略链接中的 paperId；可见性/已删除处理
- [x] 3.5 多模型提交按模型列表逆序创建 Result；「最新」按创建时间 + id；追问默认父回答
- [x] 3.7 无全文时所有 QA 创建返回 409
- [x] 3.8 `GET /api/qa/entries/:id/tree` 树读取；`GET /api/qa/results/:id/model-input`（复用 formatter 按当前状态重建，不存储，全文只给来源和长度）
- [x] 3.9 回答完成时解析 `#cite:`，列表外的 id 写入 `qa_result_cites`
- [x] 3.10 图床移除 `DELETE /api/images/:hash`；`GET /api/images` 增加 QA 引用次数
- [x] 3.6 `lib/qa-result-selection.ts` 默认 tab 改为按 `created_at` + id 判定最新（所有状态），更新其单测；PaperDetail 与 `/qa` 列表同步生效
- [x] 3.2 兼容测试：旧请求行为不变；父 QA 关闭共享后追问仍可运行/regenerate，前端历史显示「当前不可见」

## 4. Frontend

- [x] 4.1 PDF 选区工具栏「提问」+ 提问浮层（流式 Markdown 回答）；跨页选区按页分段捕获；直接提问前的 doc2x 确认框；无全文时置灰
- [x] 4.2 截图模式「截图提问」
- [x] 4.4 QA 卡片显示 `QA-<id>` 并可复制引用；复制的链接带当前论文 id；前端按 `qa`/`result` 跳转与定位
- [x] 4.5 QAInput composer：附件栏（icon/标号/摘要/页码/移除）、光标处插入 `@ImageN`/`@QuoteN`、`@` 补全（含祖先输入）、「加入提问框」入口；草稿按用户+论文存 localStorage，刷新保留、提交后清空；附件不限数量
- [x] 4.3 回答下「追问」按钮（自行输入）与 `#moonlight` 预填快捷方式，均创建子 entry；QA list 标题栏按类别 icon + 数量展示 inputs（历史不展开）；追问显示「接续 QA-x 的回答」（不可见/已删除时提示）。对话视图、树视图按用户决定不做
- [x] 4.7 图床管理页去掉删除按钮，显示 QA 引用次数
- [x] 4.6 回答下「查看模型输入」（点击才请求，注明按当前配置重建，全文只显示摘要）；列表内 `#cite:` 引用标签 + 悬停卡片，列表外降级纯文本

## 4b. 上线后 UI 调整

- [x] 4b.1 截图菜单改为四项：复制图片链接 / 复制 Markdown（带定位）/ 加入提问框 / 截图提问
- [x] 4b.2 `QAList` 折叠标题栏删除模型名/回答数 badge，`QA-<id>` 移到最右侧

## 5. Docs

- [x] 5.1 更新 `docs/frontend-architecture.md`、`docs/external-api.md`、`docs/tech-stack.md`
