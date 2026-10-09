## 1. Backend

- [x] 1.1 删除 `api/conferences.ts`、`api/conferences.test.ts`，并从 `index.ts` 移除注册
- [x] 1.2 删除 `utils/listing.ts`、`utils/listing.test.ts`；`api/papers.ts`、`external-api/papers.ts`、`services/ingest_paper.ts` 去掉 listing 规则、`listable` 与 `openreview_links`
- [x] 1.3 删除 `scripts/fix-openreview-only-listed.ts`；`auth/visibility.ts` 注释去掉 conferences
- [x] 1.4 `db/schema.ts` 删除 `conferences` / `conference_papers`；新增迁移 `0035_drop_conferences`（SQL、snapshot、journal）

## 2. Shared / Frontend

- [x] 2.1 `types.ts` 删除会议类型与 `listable`
- [x] 2.2 删除 `ConferenceList.vue`、`ConferenceDetail.vue`、`stores/conferences.ts`；`router/index.ts`、`api/client.ts` 去掉会议路由与接口
- [x] 2.3 `App.vue` 侧边栏：删除 Conferences，Research 移到第二位
- [x] 2.4 `PaperList.vue`、`PaperDetail.vue`、`stores/papers.ts` 去掉 `listable` 禁用/提示和 OpenReview 链接；`SourceTag.vue` 注释更新

## 3. OpenSpec 与文档

- [x] 3.1 删除 `openspec/changes/add-conference-view/`；`add-staged-paper-ingest` 去掉 `conference-paper-resolution` 及会议相关内容
- [x] 3.2 更新 `docs/frontend-architecture.md`、`docs/tech-stack.md`、`docs/external-api.md`

## 4. 验证

- [x] 4.1 相关后端测试通过；前端构建通过（输出到临时目录）
- [x] 4.2 无活动的 research/QA 任务时重启后端，确认迁移已应用、两张表已删除
- [x] 4.3 `openspec validate remove-conference --strict`
