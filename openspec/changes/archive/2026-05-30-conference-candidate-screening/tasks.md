## 1. Backend — API screening fields

- [x] 1.1 In `packages/backend/src/api/conferences.ts` `GET /:id/papers`, extend the linked-paper lookup to also select `abstract` and `metadata`; build a map keyed by paper id.
- [x] 1.2 Attach to each candidate: `paper_abstract` (linked paper abstract), `paper_tldr` (`metadata.tldr`), `paper_citation_count` (`metadata.citation_count`), `paper_fields_of_study` (`metadata.fields_of_study`); null when no linked paper. Keep existing `paper_listed`/`paper_arxiv_id`/`paper_corpus_id`.
- [x] 1.3 Verify via curl on conference 1 that resolved candidates return the new fields and `待添加` ones return null.

## 2. Backend — bulk promote endpoint

- [x] 2.1 Add `POST /api/conferences/:id/papers/promote` (auth required) accepting `{ ids: number[] }` (conference_paper ids); for each, look up the linked paper and, if `listed=0`, set `listed=1` and call `serviceRunner.triggerForPaper`. Skip rows with no linked paper.
- [x] 2.2 Return a summary `{ promoted, skipped, errors }`; do not duplicate or change `status` semantics beyond existing behavior.
- [x] 2.3 Add `promoteMany(confId, ids)` to `packages/frontend/src/stores/conferences.ts` calling the new endpoint.

## 3. Frontend — candidate card redesign (`ConferenceDetail.vue`)

- [x] 3.1 Add a derived `candidateState(c)` helper returning `待添加` / `仅元数据` / `已在库` from `paper_id` + `paper_listed` (ingested → 已在库); add an expand-state `Set<number>` for abstracts.
- [x] 3.2 Replace the row markup with a card: title; meta line (authors · `paper_citation_count` 引用 · `paper_fields_of_study`); `paper_tldr`; `paper_abstract` with `line-clamp` + 展开/收起.
- [x] 3.3 Add a single unified links row using explicit chips: arXiv (`displayArxivId`), S2 (`S2Badge`/`displayCorpusId`), OpenReview (`c.link`); plus the editable `#主题` chip. Remove the source badge, status badge, standalone SourceTag arXiv badge, and the "来源" link.
- [x] 3.4 Right side: state pill + primary action (`仅元数据`→加入 via promote, `已在库`→打开论文 `/papers/{paper_id}`) + a `⋯` dropdown menu with 编辑主题 and 删除. Remove the inline 确认/退回 buttons.
- [x] 3.5 Checkbox semantics: checked+disabled when `已在库`; disabled when `待添加`; otherwise selection toggle. Update `selectAll` to include only `仅元数据` rows.
- [x] 3.6 Replace the bulk action bar with "加入选中到列表 (N)" → `store.promoteMany`; remove bulk 确认/退回. Remove the top-bar "本次会议一键添加(candidate)" button and its dialog (keep 解析 / 导入 / 刷新).
- [x] 3.7 Drop now-unused code paths (status label/variant maps, confirm/revert/ingest handlers, candidateCount) where no longer referenced.

## 4. Docs

- [x] 4.1 Update `docs/frontend-architecture.md` conference detail section: candidate screening card, surfaced S2 fields (`paper_abstract`/`paper_tldr`/`paper_citation_count`/`paper_fields_of_study`), unified links, derived three-state lifecycle, checkbox=select-to-promote + bulk promote endpoint.

## 5. Verify

- [x] 5.1 `cd packages/frontend && bun run build` passes; restart backend; reload conference detail and confirm cards show TL;DR/abstract, unified links (no "-"), correct state pills, locked in-library checkboxes, and working bulk "加入选中".
- [x] 5.2 Run `openspec validate --change conference-candidate-screening` (or `openspec status`) clean.
