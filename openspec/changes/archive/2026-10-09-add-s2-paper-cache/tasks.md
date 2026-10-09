## 1. 数据与配置

- [x] 1.1 在 `db/schema.ts` 新增 `s2Papers` 表并用 `bunx drizzle-kit generate` 生成迁移；在临时数据库上跑迁移验证表与唯一索引存在
- [x] 1.2 在 `config.ts` 新增 `s2_cache`（显式默认值），在 `config.example.yml` 增加示例；补 `config.test.ts` 用例验证缺省与覆盖

## 2. S2 请求层

- [x] 2.1 在 `semantic_scholar_service.ts` 抽出共用请求逻辑，新增 `s2PostBatch(ids, fields)`（复用 rateGate / API key / 退避，按 500 分块）；用 mocked fetch 单测验证分块、null 位置、429 重试

## 3. 缓存服务与接口

- [x] 3.1 新增 `services/s2_paper_cache.ts`：id 规范化（复用 `utils/s2_ids.ts`）、论文库命中、缓存读取与新鲜度判断、batch 抓取与 upsert、负缓存、失败回退 stale、in-flight 去重、`allowFetch` 开关；用 mocked fetch + 临时库单测覆盖 spec 中各场景
- [x] 3.2 新增 `api/s2.ts` 的 `POST /api/s2/papers/resolve`（匿名不出网、上限 400、按请求顺序返回、去重）并在 `index.ts` 注册；用 `app.inject` 测试验证
- [x] 3.3 在 `packages/shared/src/types.ts` 增加 `S2PaperMeta`、`S2ResolveResult` 类型

## 4. 预热

- [x] 4.1 在 `api/qa.ts` 回答 done 后 fire-and-forget 调用 `warmCites(answer)`；单测验证预热失败不影响 done，并且预热后命中缓存

## 5. 文档与验证

- [x] 5.1 更新 `docs/frontend-architecture.md`（新接口与缓存说明）、`docs/tech-stack.md`（表结构、配置、目录）、`docs/external-api.md`（注明 External API 不变）
- [x] 5.2 运行本变更新增或改动的后端测试（只用 mocked fetch，不访问真实 S2），并在后端启动后用真实 S2 做一次小规模手工验证（1–2 个 id），确认 batch 请求与缓存命中

## 6. 实现中发现的修正

- [x] 6.1 S2 batch 在整块 id 都不存在时返回 400：`s2PostBatch` 对该块降级为逐个 GET（404/400 记为 null → 负缓存），错误对象携带 HTTP status；测试中用 403 模拟 S2 故障；新增单测验证降级并重跑 S2 相关测试（50 个通过）
- [x] 6.2 删除 `qa_result_cites`：schema、手写迁移 `0033_drop_qa_result_cites`（快照基于 0032 去掉该表）、`recordUnknownCites` 及 `api/qa.ts` 调用、两处删论文级联、测试库建表与相关用例；同步三份 docs；在内存库跑完整迁移链确认表已不存在，相关测试（qa_contextual / s2_paper_cache / s2）通过
