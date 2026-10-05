## Why

目前 Paperland 只能以「单篇论文」为单位管理已入库的文献，无法以「会议（venue）」为单位组织和浏览论文。用户希望在投稿/打榜/追会议进度时，先以会议为入口批量查看候选论文，按主题分组浏览，确认后再有选择地入库——而不是把抓取到的所有论文直接灌进正式库里。这需要一个与「论文管理」同级的独立新页面，以及一套「先进候选池、再一键入库」的导入流程。

## What Changes

- **新增「会议」顶级页面**：在侧边栏新增与「论文管理」同级的导航入口，进入后为会议列表页。
- **会议列表（入口层）**：展示全部会议，支持按名称搜索、按时间（年份/日期）筛选；每个会议以卡片展示，点击进入详情。
- **会议详情（论文列表层）**：点击会议后，按主题（如生成式模型、对齐、安全、压缩等）分组展示该会议下的论文；每篇论文展示关键字段——标题、主题、外部来源（arXiv / OpenReview / Semantic Scholar）、当前状态（待确认 / 候选中 / 已入库）。
- **导入候选池**：支持上传「预抓取文件」（JSON），解析后的论文进入该会议的候选池（草稿池），**不直接入库**，初始状态为「待确认」；用户可单个或批量将其确认为「候选中」。
- **一键入库**：会议详情页提供「本次会议一键添加」按钮，把该会议下「候选中」的论文批量触发入库（复用现有 arXiv / Semantic Scholar 抓取与去重服务），入库后状态变为「已入库」并与正式 `papers` 记录关联。
- **数据库新增两张表**：`conferences`（会议）与 `conference_papers`（会议候选论文）。

## Capabilities

### New Capabilities
- `conference-management`: 会议实体（创建 / 列表 / 详情 / 编辑 / 删除）、与论文管理同级的导航入口、会议列表页（按名称 / 时间筛选）、会议详情页（按主题分组展示论文及其来源徽章、状态徽章）。
- `conference-paper-import`: 上传预抓取文件进入候选池、候选论文的三态生命周期（待确认 / 候选中 / 已入库）与状态流转、「本次会议一键添加」批量入库（复用现有 paper 入库 / 去重 / 服务调度链路）。

### Modified Capabilities
- `database-schema`: 新增 `conferences` 表与 `conference_papers` 表（会议候选论文，含 topic、source、external_id、status、关联到 `papers.id` 的可空外键）。

## Impact

- **Backend**: 新增 `packages/backend/src/api/conferences.ts`（会议与候选论文的 Internal API 路由），并在 `packages/backend/src/index.ts` 注册；修改 `packages/backend/src/db/schema.ts` 新增两张表；新增 Drizzle 迁移；入库逻辑复用 `services/paper_dedup.ts`、`service_runner.ts` 及现有 `POST /api/papers` 链路。
- **Frontend**: 新增 `views/ConferenceList.vue`、`views/ConferenceDetail.vue` 两个页面与对应路由；新增导入对话框组件与「一键添加」交互；新增 `stores/conferences.ts` Pinia store；修改 `App.vue` 增加导航项、`router/index.ts` 增加路由。
- **Shared**: `packages/shared/src/types.ts` 新增 `Conference`、`ConferencePaper`（含 status / source 枚举）等类型。
- **Database**: 需要新的 Drizzle 迁移（新增表，不改动既有表）。
- **Docs**: 更新 `docs/frontend-architecture.md`（新增页面/路由/store）、`docs/external-api.md` 或内部 API 说明（新增 conferences 端点）、`docs/tech-stack.md`（如有必要）。
