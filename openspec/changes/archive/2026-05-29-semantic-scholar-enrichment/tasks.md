## 1. 配置与类型（基础）

- [x] 1.1 `packages/backend/src/config.ts`：在 `serviceSchema` 增加可选字段 `api_key`、`api_key_env`（`z.string().optional()`）
- [x] 1.2 `packages/shared/src/types.ts`：`ServiceConfig` 同步 `api_key`、`api_key_env`
- [x] 1.3 确认 `config.yml` 的 `semantic_scholar_service` 块（已含 `api_key`、`max_concurrency: 1`、`rate_limit_interval: 1`）通过 Zod 校验；在 `config.example.yml` 增加同名块（不含真实 key，注释说明 `api_key_env` 用法与"无 key 时建议 `rate_limit_interval: 3`"）

## 2. 后端 S2 服务重写（`services/semantic_scholar_service.ts`）

- [x] 2.1 共享 fetch 核心 `fetchS2(idExpr, apiKey?)`：拼接 `fields=externalIds,title,abstract,authors,citationCount,influentialCitationCount,references.title,references.year,tldr,venue,year,publicationVenue,fieldsOfStudy,publicationDate`，存在 key 时带 `x-api-key` 头
- [x] 2.2 `fetchS2WithBackoff`：对 429/5xx 指数退避 + 抖动（若响应带 `Retry-After` 则优先），403（key 无效）直接抛错不退避
- [x] 2.3 `mapS2ToPaperFields(data)`：把 `externalIds` 中本论文尚缺的 id 写回（`corpus_id` 数字转字符串 → 顶层）；`citation_count`/`influential_citation_count`/`references`(`paper_id`,`title`,`year`)/`tldr`(取 `.text`)/`venue`/`year`/`doi`(`externalIds.DOI`)/`fields_of_study`/`s2_url`（由 `data.paperId` 构造）→ metadata；**缺失字段跳过**；`title`/`abstract`/`authors` 照常返回交给 runner "仅空填充"
- [x] 2.4 导出单个 `semanticScholarService`：name `semantic_scholar_service`，`depends_on: ['arxiv_id']`，`produces: ['corpus_id','citation_count','influential_citation_count','references']`（不含 `tldr`，见 design Decision 1），按 `ARXIV:{arxiv_id}` 查询
- [x] 2.5 API key 读取：service config 的 `api_key` 优先，否则用 `api_key_env` 读环境变量；都没有则匿名请求

## 3. 调度器、注册与存量回填

- [x] 3.1 `service_runner.ts`：(a) 写入 `corpus_id` 前查 UNIQUE 冲突，冲突则跳过该字段、仍写其余、不抛错；(b) **修复多字段写入**——执行前读论文一次、循环内累积 metadata/contents 后只写一次（旧逻辑每键重读库，导致一次写多个 metadata 键时只剩最后一个，使 citation_count/tldr 被 s2_url 覆盖）。见 design Decision 4
- [x] 3.2 `index.ts`：注册单个 `semanticScholarService`（export 名未变，旧 `depends_on:[corpus_id]` 实现已被替换，注册处无需改动）
- [x] 3.3 `api/services.ts`：新增 `POST /api/services/backfill/semantic_scholar_service`——查询 `arxiv_id` 非空且 metadata 缺 `citation_count` 的论文（覆盖未富化与仅部分富化者），逐篇 `serviceRunner.executeServiceForPaper('semantic_scholar_service', id)`（fire-and-forget，runner 限流串行），返回入队数量

## 4. 前端（列表 / 详情 / 回填入口）

- [x] 4.1 新增 `components/S2Badge.vue`：有 `corpus_id` 时渲染可点击 Badge（`as="a"`，新标签页打开），链接优先 `metadata.s2_url`，回退 `https://www.semanticscholar.org/paper/CorpusID:{corpus_id}`
- [x] 4.2 `views/PaperList.vue`：在"来源"列 `SourceTag` 旁渲染 `S2Badge`（传 `corpus_id` 与 `metadata`）
- [x] 4.3 `views/PaperDetail.vue`：把宽/窄屏现有纯文本 `Corpus: {id}` Badge 替换为可点击 `S2Badge`
- [x] 4.4 `views/PaperDetail.vue`：在 metadata 区展示 `citation_count`、`influential_citation_count` Badge 与 `tldr` 小块；从 `store.currentPaper.metadata` 读取，缺失则不渲染
- [x] 4.5 `views/ServiceDashboard.vue`：新增"回填 S2 数据"按钮，调用回填接口并提示入队数；进度经既有 `service_executions` 列表查看

## 5. 文档（每次代码变更必须同步）

- [x] 5.1 `docs/frontend-architecture.md`：更新依赖图方向、service 声明、DB `metadata` 字段表、服务名一致性说明、限流图中 S2 数值（1/1）、corpus-only 流程说明
- [x] 5.2 `docs/tech-stack.md`：更新 S2 config 块（服务名/数值/`api_key`(`_env`)）；`semantic_scholar_service.test.ts` 现已新增，引用不再过时
- [x] 5.3 `docs/external-api.md`：在 `/papers/full` 响应示例补充 `metadata` 的 S2 字段，并修正 `auto_create` + corpus_id 不再反查 arxiv_id 的说明

## 6. 验证

- [x] 6.1 新增 `semantic_scholar_service.test.ts`（mock `fetch`，不打真实 API）：字段映射、`ARXIV:` URL、`x-api-key` 头、429 退避、写回 id、缺字段跳过、服务声明 —— `bun test` 7/7 通过
- [x] 6.2 用本地 key 完成**完整在线实测**：重启后端加载新代码（`getServiceInfo()` 返回 `semantic_scholar_service max_concurrency=1`，证实服务名错配已修复）；触发回填后**全部 146 篇 arxiv 论文成功补全** corpus_id + citation_count/influential/references/tldr/venue/year/s2_url，0 失败。期间实测发现并修复了 runner 多字段写入覆盖的潜在 bug（见 3.1b）
- [x] 6.3 提交前安全检查：`git status` 无 `packages/backend/data/`；`config.yml`（含密钥）已 gitignore、未出现在 `git status`

## 7. 引用图抓取与存储（S2 citation graph，应用户追加）

- [x] 7.1 `db/schema.ts` 新增 `paper_citations` 表（paper_id, direction, s2_paper_id, corpus_id, arxiv_id, doi, title, authors, year, venue, url, contexts, intents, is_influential, created_at）+ (paper_id, direction) 索引；`drizzle-kit generate` 生成迁移 `0009`
- [x] 7.2 `semantic_scholar_service.ts`：新增模块级共享限流门 `rateGate()`；`fetchS2` 改走通用 `s2Get`（限流 + 退避 + `x-api-key`）
- [x] 7.3 `semantic_scholar_service.ts`：`fetchAndSaveEdges`——`/references` 与 `/citations` 各取一页（`limit=1000`），`mapEdge` 映射（title/authors/year/venue/externalIds→arxiv/doi/corpus/url、contexts/intents/is_influential），按方向先删后插、分批 insert；best-effort，不阻断主富化
- [x] 7.4 `api/papers.ts`：新增 `GET /api/papers/:id/citations` 读取接口（按 direction 分组返回，解析 JSON 字段）
- [x] 7.5 删除级联：`api/papers.ts` 与 `external-api/papers.ts` 删除论文时清理 `paper_citations`
- [x] 7.6 回填资格扩展为"缺 `citation_count` 或无 `paper_citations` 行"；`packages/shared/src/types.ts` 增 `PaperCitation` 类型
- [x] 7.7 单测：`mapEdge` 映射（reference/citation 两方向、空 contexts→null、influential 标志）—— `bun test` 9/9 通过
- [x] 7.8 在线实测：迁移自动应用、回填后样本论文成功写入 references/citations（含 contexts/作者/链接），读取接口正常
