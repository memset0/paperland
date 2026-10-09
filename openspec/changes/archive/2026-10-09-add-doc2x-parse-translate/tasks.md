## 1. 配置与调度基础

- [x] 1.1 `config.ts`：新增 `doc2x` 配置块（enabled/cli_path/timeout/output_dir/auto_parse_since/parse/translate，nested 块使用显式默认值）；服务配置新增可选 `concurrency_group`；`content_priority` 默认值改为 `[user_input, doc2x_parsed, pdf_parsed]`；`config.test.ts` 补充“无 doc2x 块时 disabled”和“默认值”的测试并通过
- [x] 1.2 `packages/shared` 同步 `ServiceConfig.concurrency_group`，新增 `Doc2xStatus` 类型；前后端类型检查通过
- [x] 1.3 `base_service.ts` 新增可选 `eligible`；`service_runner.ts` 的 `buildExecutionPlan` 和完成后重检查中，不合格的服务静默跳过；`initialize`/`register` 支持 `concurrency_group` 共享信号量；在 `service_runner.test.ts` 中补充 eligibility 和共享组的测试并通过
- [x] 1.4 `config.yml` 增加 `doc2x` 块（enabled: true，翻译模型 "85"，auto_parse_since 设为上线日期）、`services.doc2x_parse/doc2x_translate`（max_concurrency 5，concurrency_group doc2x），`content_priority` 加入 `doc2x_parsed`；`config.example.yml` 同步（enabled: false，附带安装和登录说明）；后端能正常启动

## 2. doc2x 后端服务

- [x] 2.1 新增 `services/doc2x_cli.ts`：spawn、超时 kill、stdout/stderr JSON 解析、错误映射（ENOENT / 退出码 2 / 超时 / 其他）、输出文件发现；`doc2x_cli.test.ts` 用假的 CLI 脚本覆盖这些分支，不调用真实 doc2x
- [x] 2.2 新增 `services/doc2x_parse_service.ts`（paper-bound，eligible 按 D1），把 Markdown 写入 `contents.doc2x_parsed`、产物存到 `data/doc2x/<id>/parse/`；用假的 CLI 做单测验证产出键
- [x] 2.3 新增 `services/doc2x_translate_service.ts`（paper-bound，eligible 为请求标记），参数包含模型、目标语言、`--ignore-translate-types`，完成后用 pdf-lib 裁出仅译文 PDF 并写入 `metadata.doc2x_translation`；后端安装 `pdf-lib`；用 5 页实测生成的 bilingual.pdf 做单测，验证裁剪后页数相同、宽度减半
- [x] 2.4 `index.ts` 注册两个服务；论文删除时清理 `data/doc2x/<id>/`；后端启动后 `/api/services` 中能看到两个服务

## 3. API

- [x] 3.1 新增 `api/doc2x.ts`：`GET /api/papers/:id/doc2x` 状态汇总（按 D6 规则）、`POST .../doc2x/parse`、`POST .../doc2x/translate`（排队、去重、必要时启动解析）；`api/doc2x.test.ts` 用内存数据库和 stub 掉的服务执行，覆盖 queued、409 去重、重试、422、404
- [x] 3.2 `index.ts` 注册路由，并用 curl 确认 GET 返回结构正确

## 4. 前端

- [x] 4.1 新增 `components/Doc2xTranslationTab.vue`：显示解析状态并提供“开始解析”按钮；翻译的 idle/queued/running/failed/done 各状态；轮询；左右对照和仅译文切换（存 localStorage）；完成态用 `PdfViewer :paper-id="null"` 显示
- [x] 4.2 `PaperViewerPanel.vue`：在 PDF 原文之后插入“对照翻译”模式（有 PDF 且 doc2x 启用时可用），不影响默认选择；前端构建通过
- [x] 4.3 `stores/qa.ts`：4 个提问入口前加入 doc2x 确认，取消时不发请求且保留输入；检查调用方对取消的处理（QAInput 等）；前端构建通过
- [x] 4.4 详情页新增两个“复制全文”按钮（直接解析 / doc2x），按对应 contents 是否存在决定能否点击；doc2x 状态轮询发现解析完成后刷新论文数据，按钮随之变为可点击；复制成功弹 toast；前端构建通过

## 5. 文档

- [x] 5.1 更新 `docs/tech-stack.md`（doc2x CLI 前置条件、config 块、concurrency_group、eligible、data/doc2x 目录、content_priority）、`docs/frontend-architecture.md`（对照翻译 tab、Q&A 确认）、`docs/external-api.md`（注明 External API 不变、内部 doc2x API 列表）

## 7. 方案 B：parseId 入库 + 翻译复用 parseId

- [x] 7.1 config：`auto_parse_since` 改名为 `auto_since`，并新增 `token_file`、`gateway_url`（都带默认值）；同步 `config.yml`、`config.example.yml`、shared 类型和测试，测试通过
- [x] 7.2 `doc2x_parse` 把回执中的 parseId 写入 `metadata.doc2x_parse_id`；单测断言该值
- [x] 7.3 新增 `services/doc2x_gateway.ts`（token 读取，过期时自动刷新；`CreateTranslateTask` → 轮询 `GetTaskStatus` → `CreateExternalPDFMergeTask` → 下载）；`doc2x_translate` 优先复用 parseId，失败时回退 CLI，并记录 `parse_id`/`translate_id`；单测 mock 掉 fetch，覆盖复用路径与回退路径
- [x] 7.4 更新 docs（tech-stack 的 config 块和依赖、frontend-architecture 的服务章节）
- [x] 7.5 实测：用真实 parseId 跑一次翻译，确认没有扣页数、只扣了积分，且两个 PDF 都生成

## 6. 端到端验证

- [ ] 6.1 从项目根目录启动后端，对一篇小论文（如 5 页的 2603_03524 对应论文）手动触发 parse，确认 `contents.doc2x_parsed` 写入、Q&A 状态里 `qa_source` 变为 doc2x_parsed
- [ ] 6.2 对同一篇论文请求翻译，确认重复请求返回 409，完成后两个 PDF 都能通过 `/api/files/*` 访问且页数正确；再在浏览器中检查“对照翻译”tab 的两种显示方式和 Q&A 确认弹窗
