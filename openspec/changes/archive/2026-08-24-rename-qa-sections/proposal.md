## Why

论文详情页右侧两个 Q&A 卡片当前的标题"Template Q&A"和"Free Q&A"信息量低、且不对仗 — Template 只表达了"是不是预设的"，完全没体现出"共享 vs 个人"这个对用户更关键的差别；Free 则过于笼统（"自由"），让匿名/其他用户难以直观理解"为什么我看不到"。新名字 **Preset Q&A / User Q&A** 更工整、来源意图更清晰（系统预置 vs 用户主动输入），与现有 UI 英文标签风格（Notes / Walkthrough）保持一致。

## What Changes

- 论文详情页右侧 Q&A 卡片标题文案：
  - "Template Q&A" → **"Preset Q&A"**
  - "Free Q&A" → **"User Q&A"**
- 同步更新 `docs/frontend-architecture.md` 中所有出现旧名字的位置（架构示意图 + 卡片说明段落）
- 不改动：DB schema（`qa_entries.type='template'/'free'`）、API 路径/参数（`auto_template_qa` query param、JSON 字段）、内部代码命名（`QAList` 中的 `templateEntries` / `freeEntries` 变量、store 的 `qaData.template` / `qaData.free` 字段）— 那些是实现细节，改名收益不抵风险
- 不改动：历史 archive 里的 spec 快照（`openspec/changes/archive/2026-05-29-add-user-auth/specs/qa-display-split/spec.md`），那是历史记录

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `qa-display-split`：所有出现 "Template Q&A" / "Free Q&A" 字面量的 requirement / scenario 描述需要更新到 "Preset Q&A" / "User Q&A"。requirement 的语义与行为不变，纯文案替换。

## Impact

- 改动文件：
  - `packages/frontend/src/components/QAList.vue`（两处 `<h3>` 标题文字）
  - `openspec/specs/qa-display-split/spec.md`（多处 requirement / scenario 字面量）
  - `docs/frontend-architecture.md`（架构示意图 + 卡片说明段落）
- 不影响：API、DB、URL、其他 QA 组件（QAFeedPanel / QAResultView / QAInput / QAPanelNav / QAPage）、sidebar、feed 页文案（feed 页不显示这两个 section 标题）
- 风险极低：仅前端 UI 文案 + 文档同步，无行为变更；可立即回滚
