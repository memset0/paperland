## Context

- Conference 功能由 `add-conference-view`（页面、接口、两张表）和 `add-staged-paper-ingest`（候选 S2 解析、`papers.listed`）引入，两者都已实现但从未归档；主 spec 中只有 `conference-candidate-screening` 与 `paper-listing-eligibility` 直接依赖会议数据。
- `paper-listing-eligibility` 用 `conference_papers.link` 统计 OpenReview 链接，判断论文是否可以 `listed=true`。实库中只有论文 217（AIRS）受此规则约束。
- Research 入口由 `add-deep-research` 添加，目前排在 Notes 之后。

## Goals / Non-Goals

**Goals:** 完全移除 Conference 代码与表；Research 放到侧边栏第二位；旧变更中的会议内容不再会被归档进主 spec。

**Non-Goals:** 改动 `papers.listed` 机制；清理会议导入产生的 `listed=false` 论文；修改 `add-deep-research` 的 spec delta。

## Decisions

- **删表用手写迁移**：`0035_drop_conferences.sql` 先删 `conference_papers`（含索引，外键指向 `conferences` 和 `papers`），再删 `conferences`。snapshot 由 0034 snapshot 去掉两张表得到，journal 追加 idx 35，做法与 0033 相同。
- **整个移除 listing eligibility**，而不是改写成“缺少 arXiv/S2 来源就不能加入列表”：后者会影响手动添加的博客/链接论文（它们本来就没有 arXiv/S2 来源），超出本变更范围。`listable`、`openreview_links` 字段和 `LISTING_NOT_ALLOWED` 一并去掉，前端相应代码删除。
- **`utils/listing.ts` 整个删除**：其中 `hasArxivSource` / `hasS2Source` 只被 `canList` 使用。
- **旧变更处理**：`add-conference-view` 整体删除（全部内容都是会议）；`add-staged-paper-ingest` 只删掉 `specs/conference-paper-resolution/` 和 proposal/design/tasks 中的会议条目，其余保持原样。

## Risks / Trade-offs

- [不可逆删除会议数据] → 数据已迁到 Research 会话；每日备份与 git 历史保留旧实现。
- [论文 217 等原 OpenReview-only 论文现在可以加入列表，但没有可抓取的来源] → 管线会正常失败并记录，影响仅限少数论文。
- [`add-deep-research` 的 sharing delta 仍提到 conferences] → 在 proposal 中记录，需在它归档前修正。
