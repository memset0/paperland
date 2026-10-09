## 1. 数据与配置

- [x] 1.1 新增 `research_sessions` / `research_steps` 表（含 `kind`、`step_index`）并生成迁移（确认迁移编号连续），在临时库上验证级联删除和唯一约束
- [x] 1.2 `config.ts` 新增 `research`（system_prompt、history_char_budget、abstract_char_limit，默认值显式写出）和 `services.research`；`config.example.yml` 加示例；新增 `prompts/system/research.md`；`config.test.ts` 验证默认值
- [x] 1.3 共享类型 `research`：shared 类型、`SHARING_DATA_TYPES`、按类型的默认值（research=false）、`/api/auth/me/sharing` 支持读写；用测试验证默认值与 PUT

## 2. 研究后端

- [x] 2.1 `services/paperlist.ts`：拆分报告与列表块（两者缺一不可，报告非空）、提取最后一个块、zod 校验（论文条目只取 s2_id + comment，忽略多余字段；链接条目 url + BibTeX 风格 citation，title 必填；二者互斥）、批量解析 id（解析不到标 unverified，不做标题匹配）、段内去重（允许跨段重复）、提取 `changes`；单测覆盖正常、跨段重复、段内重复、缺报告、多块、无块、坏 JSON、两种 id 都有或都没有、博客链接条目、id 解析不到、重复
- [x] 2.2 `services/research_prompt.ts`：按 D3 以类 XML 组装输入（未验证论文标 `verified="false"` 并要求 agent 更正或删除；`<current_version>` 含报告与带 S2 元数据的 `<paper_list>`、摘要截断、XML 转义、历史预算截断）；`prompts/system/research.md` 写明输出规则（同时输出完整报告与列表、论文只写 s2_id + comment、不重复元数据）；单测验证顺序、元数据字段、截断、转义、第二轮包含上一版报告和列表
- [x] 2.3 `services/research_runtime.ts`：调度（`services.research` 的 Semaphore/RateLimiter，不写 service_executions）、状态机、partial writer、新 broker 实例、完成前解析列表、取消、启动恢复；单测（mock callModel）覆盖 done / failed / cancelled / 重启恢复 / 解析失败保持上一版
- [x] 2.4 `api/research.ts`：会话 CRUD（创建时启动首轮、seed_result 快照及可见性校验、只接受 Codex 模型、无 Codex 模型时报错）、提交新轮（409 规则）、重试最后一轮、取消、标题编辑生成新版本（只接受标题字段，有进行中回合时返回 409）、从历史版本继续（事务内删除后续步骤，有进行中回合时返回 409）、SSE 流、mine/all 列表与可见性；在 `index.ts` 注册；inject 测试覆盖 spec 中各场景
- [x] 2.5 自动修复（D2a）：`research_steps` 增加 `repaired` 列（迁移）；解析失败时同一 round 内用同一模型修复一次（只缺列表时只要 paperlist 并沿用原报告，缺报告时要完整输出），SSE `repairing` 事件，可取消；单测（mock callModel）覆盖修复成功、修复失败保持上一版、修复中取消

## 3. 前端

- [x] 3.1 shared 类型与 `stores/research.ts`（列表、详情、创建、提交、重试、取消、SSE 订阅与重连）；通过 vue-tsc
- [x] 3.2 路由 `/research`（meta.title/icon）与 `/research/:id`，`App.vue` 侧边栏增加 Research（需登录）；`views/ResearchList.vue`（AppPage、mine/all、新建对话框含 Codex 模型选择，处理 `?new=1&seed_result=`）
- [x] 3.3 `views/ResearchDetail.vue`：步骤时间线（agent 回合与标题编辑）、流式报告（QA 回答式 cite 渲染）与 paperlist 占位、版本视图（Report / Papers tab，报告下方 References 列表；所有历史版本均可查看）、「从此版本继续」及删除后续版本的确认提醒、列表总标题和段标题的行内编辑（在历史版本上编辑时先提醒并回退）、输入框与模型选择（默认沿用上一轮）、重试与取消、非 owner 只读、窄屏单栏
- [x] 3.4 `PaperRefList` 的 comment 与 section description 用 MarkdownContent（qa-answer 模式）渲染；增加链接条目（按 citation 格式化显示：标题、作者、年份、howpublished 或域名，新标签页打开）、unverified 标记（显示 id 与 S2 链接）、逐段 added 标记和 Removed 分组、「Fixing paper list…」占位；`QAResultBody` 增加「Deep Research」入口；`AccountDialog` 增加 Research 共享开关
- [x] 3.5 运行 vue-tsc 与 vite build；在运行中的应用里实际跑一个两轮的研究会话（真实 Codex 模型），验证列表解析与 id 校验、版本对比、标题编辑生成新版本、从历史版本继续时的提醒与删除、从 QA 起步、共享开关生效

## 4. 文档

- [x] 4.1 更新 `docs/frontend-architecture.md`（页面、交互、协议、可见性）、`docs/tech-stack.md`（表、配置、目录）、`docs/external-api.md`（注明不变）
