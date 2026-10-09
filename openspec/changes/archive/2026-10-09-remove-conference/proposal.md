## Why

Conference 页面（会议列表、候选池、按主题分组）原本用来整理 MLSys 2026 等会议的论文。Deep Research 上线后，这类按方向分类的论文列表改由 Research 会话维护：MLSys 2026 的列表已经迁到 Research 会话（id 2）。Conference 功能不再使用，留着只会增加维护负担。Research 应该占据它在侧边栏的位置。

## What Changes

- **侧边栏**：Research 入口移到第二位（Papers 之后，即原 Conference 的位置）；删除 Conferences 入口。
- **移除 Conference 功能**（只保留在 git 历史中）：会议列表页与详情页、前端 store、路由、`/api/conferences*` 接口及其测试、shared 中的会议类型、只服务于会议数据的修复脚本。
- **BREAKING（数据库）**：删除 `conferences` 与 `conference_papers` 两张表（新迁移 `0035_drop_conferences`）。属于不兼容的 schema 变更，归档时 MINOR 版本 +1。会议导入时创建的 `listed=false` 论文保留不动。
- **移除「OpenReview-only 论文不可加入列表」规则**：该规则依据 `conference_papers` 中的 OpenReview 链接判断，表删除后没有判断依据。论文 API 不再返回 `listable` 与 `openreview_links`，不再返回 `LISTING_NOT_ALLOWED`；前端去掉相应的禁用与提示，以及论文详情页的 OpenReview 链接。
- **清理两个未归档的旧变更**：删除 `add-conference-view` 整个变更目录；`add-staged-paper-ingest` 去掉 `conference-paper-resolution` 能力及其他会议相关内容，保留 `papers.listed`（paper-staging）等其余部分。
- 文档：`docs/frontend-architecture.md`、`docs/tech-stack.md`、`docs/external-api.md` 同步。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `responsive-nav`: 导航项包含 Research 且位于第二位，不再包含 Conferences。
- `page-layout`: 示例中的 Conference 页面替换为 Research / 去除。
- `personal-paper-library`: 「加入论文库」的动作列表去掉会议一键入库。
- `page-title`: 删除会议页面标题需求。
- `conference-candidate-screening`: 整个能力删除。
- `paper-listing-eligibility`: 整个能力删除。

## Impact

- **Backend**：删除 `api/conferences.ts`（+test）、`utils/listing.ts`（+test）、`scripts/fix-openreview-only-listed.ts`；修改 `index.ts`、`api/papers.ts`、`external-api/papers.ts`、`services/ingest_paper.ts`、`services/semantic_scholar_service.ts`（删除只被会议使用的 `matchPaperByTitle`）、`auth/visibility.ts`（注释）、`db/schema.ts`；新增迁移 `0035_drop_conferences` 及 snapshot/journal。
- **Frontend**：删除 `views/ConferenceList.vue`、`views/ConferenceDetail.vue`、`stores/conferences.ts`；修改 `App.vue`、`router/index.ts`、`api/client.ts`、`views/PaperList.vue`、`views/PaperDetail.vue`、`stores/papers.ts`、`components/SourceTag.vue`（注释）。
- **Shared**：`types.ts` 删除会议类型与 `listable`。
- **数据**：两张表的数据随迁移删除；MLSys 2026 列表已在 Research 会话中，每日备份也保留。
