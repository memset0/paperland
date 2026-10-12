## Why

QA 折叠时目前无法看出当前用户是否已经认真阅读或在笔记中引用过回答。显示当前用户在该 QA 下的高亮数和笔记锚点数，可以在不展开答案的情况下提供明确的阅读痕迹。

## What Changes

- `qa_results` 增加完成回答的稳定 `content_hash`，使用现有“去除全部空白后 MD5”算法并回填历史结果。
- `highlights` 增加 nullable `qa_result_id`；QA answer 创建高亮时提交 result id，后端校验 result→entry→paper、pathname 和 content hash。非 QA 高亮保持 null。
- 对历史高亮仅在 pathname+hash 唯一匹配一个 result 时回填；歧义或过期记录不猜测、不删除。
- QA read response 为每个 entry 返回当前 viewer 的 `highlight_count`，从实际 highlight rows 聚合，不缓存计数。
- 从当前用户该论文唯一 `notes.body` 解析 `paperland://paper/<id>?h=...` block anchors，通过 result content hash 派生 `note_anchor_count`；重复链接重复计数，PDF/跨论文/过期/歧义链接不计。
- PaperDetail 与 `/qa` feed 折叠 header 在非零时显示紧凑“高亮 N / 笔记引用 N”指示器，并在高亮或笔记更新后刷新。
- 不建立 note-anchor 表，不暴露其他用户的高亮、笔记或计数。
- 同步更新三份 `docs/` 架构文档。

## Capabilities

### New Capabilities

- `qa-reading-indicators`: 当前 viewer 的 QA 高亮数与笔记锚点数的计算、API 和折叠态展示。

### Modified Capabilities

- `database-schema`: 为 QA result/hash 与 highlight attribution 增加增量字段和索引。
- `markdown-highlight`: QA highlight 保存可验证的 result 归属并支持安全历史回填。
- `markdown-anchors`: 当前用户 note body 中的 QA block anchors 可按 entry 派生计数。
- `qa-display-split`: PaperDetail 折叠 QA header 展示两个阅读指标。
- `qa-feed-page`: Feed 复用同一指标并按页面批量聚合。

## Impact

- Backend/database: Drizzle migration、MD5 backfill、highlight API validation、note-anchor parser、QA response aggregation。
- Frontend/shared: MarkdownContent/QAResultView result context、QA store/types、QAList/QAFeedPanel indicators。
- Performance: 每页批量查询 highlights/notes；note body 每论文只解析一次，无冗余计数写入。
- Docs: `frontend-architecture.md`、`external-api.md`、`tech-stack.md`。
