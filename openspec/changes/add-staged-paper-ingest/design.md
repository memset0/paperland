## Context

现有论文管线（`service-dependency-graph` / `service-runner` / `paper-dedup`）：论文创建即 `serviceRunner.triggerForPaper(paperId)`，按 `depends_on`/`produces` 拓扑调度 paper-bound 服务。实测各服务声明：

| service | depends_on | produces |
|---|---|---|
| `semantic_scholar_service` | `arxiv_id` | `corpus_id, citation_count, influential_citation_count, references` |
| `arxiv_metadata_service` | `arxiv_id` | `link` |
| `arxiv_pdf_service` | `arxiv_id` | `pdf_path` |
| `papers_cool` | `arxiv_id` | `papers_cool_summary` |
| `pdf_parse_service` | `pdf_path` | `contents.pdf_parsed` |

basic fields（title/abstract/authors）"任何 fetch 服务为空则补"。`ingestPaper({arxiv_id?,corpus_id?,title?,authors?,link?,content?})` 按 `arxiv_id`/`corpus_id` 去重，命中即合并、否则插入，并 `triggerForPaper`。S2 已核实可用 `search/match`（title→best match，返回 `corpusId`+`externalIds.ArXiv`+`matchScore`），且 S2 限流（~1 RPS）已由 service runner 的 `rate_limit_interval` 管理；arxiv 限流更紧。

用户已确认：可见性**全局**；`listed=false` 的论文**只走 S2、不抓 arxiv pdf/metadata**，直到被"加入"；要兼容旧 spec 流程。

## Goals / Non-Goals

**Goals:**
- `papers.listed` 全局可见性；两层论文：仅元数据（`listed=false`，S2 来源、隐藏）vs 已列出（`listed=true`，完整管线、显示）。
- `listed=false` 时只跑 `semantic_scholar_service`；arxiv/pdf/papers.cool 延后；提升为 `listed=true` 触发完整管线。
- S2 优先供给 basic fields + abstract，arxiv 退兜底/仅 PDF，降低 arxiv 限流压力。
- **向后兼容**：默认 `listed=true`，存量与常规添加流程行为不变。

**Non-Goals:**
- 不做按用户可见性（沿用论文全局共享模型）。
- 不改去重算法本身（仍按 `arxiv_id`/`corpus_id` 唯一 + `ingestPaper`）。
- 不为 S2 未命中的候选强行造空 paper 行（保持 `待添加` / 手动）。
- 不做 PDF 的 S2 托管替代（仅可用 `openAccessPdf.url` 作为来源，PDF 仍是 listed 后才抓）。

## Decisions

### D1. `papers.listed` 全局布尔，默认 true
`ALTER TABLE papers ADD COLUMN listed INTEGER NOT NULL DEFAULT 1` —— SQLite 对存量行回填为 1（已列出），常规新增也默认 1。**只有显式传 `listed=false` 才进仅元数据层。** 所有"列表"出口加 `WHERE listed=1`；`GET /api/papers/:id` 直链仍可访问隐藏论文（论文本就公开）。

### D2. `requires_listed` 服务门禁（挂在依赖图上，旧流程零变更）
在 paper-bound 服务定义加可选 `requires_listed: boolean`。标记 `arxiv_metadata_service`、`arxiv_pdf_service`、`papers_cool`、`pdf_parse_service` 为 `requires_listed: true`；`semantic_scholar_service` 不标（始终可跑）。

调度时**新增一个与 `depends_on` 并列的门禁**：服务可执行 ⟺ `depends_on 满足` **且** `(paper.listed 为真 或 该服务非 requires_listed)`。对 `listed=false` 论文，`requires_listed` 服务记为新状态 **`deferred`**（"等待加入列表"，非失败、非 blocked），不执行。
- **关键兼容性**：当 `listed=true`（默认）时该门禁恒为真 → 调度与旧 spec **完全一致**；`deferred` 是 `listed=false` 这一**新状态**下才出现的分支，不触碰任何既有行为。`semantic_scholar_service` 无 `requires_listed`，对仅元数据论文照跑，产出 id + 引用图 + basic fields。
- **备选**：在每个服务 `execute` 内自检 listed（驳回：分散、易漏、状态不可见）；用 `blocked` 复用（驳回：语义混淆——blocked 指依赖不可产出，deferred 指"故意等加入"）。

### D3. 提升为 listed 触发完整管线
`listed: false→true` 时调用 `triggerForPaper(paperId)` 重跑：此时门禁放开，`deferred` 的 `arxiv_metadata`/`arxiv_pdf`(`→pdf_path→pdf_parse`)/`papers_cool` 依次执行。已完成的 S2 工作因"produces 已存在"被跳过（旧的 skip-already-complete 逻辑），不重复。
- promote 入口：`PATCH /api/papers/:id { listed: true }`（或 `POST /api/papers/:id/list`）。

### D4. S2 优先元数据，arxiv 退兜底
`semantic_scholar_service` 在富集时**顺手填 basic fields（title/authors）+ abstract（为空才填）**——这样仅元数据论文无需 arxiv 即有完整文本信息。`arxiv_metadata_service` 仍产出 `link` 并作为 abstract/字段的**补缺**（S2 偶尔 `abstract=null` 时），且 `listed` 后才跑。PDF：优先用 S2 `openAccessPdf.url` 作为来源，`arxiv_pdf_service` 兜底——二者均 `requires_listed`。
- S2 现以 `arxiv_id` 为 key，故 ingest 先 seed `arxiv_id` 再跑 S2。**边角**：仅有 `corpus_id`（无 arxiv）的论文，需让 S2 支持以 `corpus_id` 取数（小改）或暂留待手动；本列表绝大多数有 arxiv。

### D7. 列表过滤的波及面（务必逐个覆盖）
加 `listed=1` 过滤：`api/papers.ts` 列表 + 搜索 + 标签筛选计数；`external-api/papers.ts` 的 `GET /papers`、`/papers/full`、`/papers/batch` 查询；idea-forge paper dump 的候选选取。**不**过滤：`GET /api/papers/:id` 直链、去重查询（按 id 命中即可，含隐藏）。

## Risks / Trade-offs

- **隐藏论文仍是完整行**（可直链访问、可被打标签/问答）→ 可接受：论文本公开，只是不进列表。
- **S2 题名误匹配** → 错绑元数据。Mitigation：`matchScore` 阈值 + 把匹配标题/年份留给人工复核，低分不自动绑。
- **S2 abstract 覆盖非 100%** → 个别仅元数据论文 abstract 缺失，待 promote 后由 arxiv 补。可接受。
- **遗漏某个列表出口的 `listed` 过滤** → 隐藏论文泄漏进列表。Mitigation：集中过滤、tasks 中逐一枚举端点并验证。
- **corpus-only（无 arxiv）论文** → 以 arxiv 为 key 的 S2 服务跑不起来。Mitigation：S2 支持 `corpus_id` seed 或暂留手动。
- **promote 重复触发** → 已完成服务重跑。Mitigation：复用既有 skip-already-complete（produces 已存在则跳过）。

## Migration Plan

向后兼容、增量：
1. schema：`papers.listed`（默认 1）→ `bunx drizzle-kit generate`（ALTER ADD COLUMN，存量自动回填 1）。
2. `base_service` 加 `requires_listed`；标记 arxiv_metadata/arxiv_pdf/papers_cool/pdf_parse。
3. `service_runner`：调度门禁 + `deferred` 状态 + promote 重触发。
4. `ingestPaper`：新增 `listed` 入参（默认 true）。
5. `semantic_scholar_service`：填 basic fields + abstract。
6. 列表查询按 `listed` 过滤（papers / external / idea-forge）。
7. promote 端点 + 前端动作。
8. docs。
回滚：`listed` 列与 `requires_listed`/`deferred` 保留无害；移除过滤即恢复旧行为。

## Open Questions

- 是否支持 `corpus_id`-only 的 S2 取数（扩 S2 seed），还是这类暂留手动？
- promote 是否在某些动作上自动发生（如用户对隐藏论文发起问答时自动加入）？倾向仅显式。
