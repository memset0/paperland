## Context

论文详情页 (`packages/frontend/src/views/PaperDetail.vue`) 通过 `QAList.vue` 渲染两张并排的 Q&A 卡片。当前两张卡片的标题分别为 "Template Q&A" 与 "Free Q&A"，用户反馈这两个名字信息量低、不对仗。本设计要解释如何把这两处 UI 文案统一改为 "Preset Q&A" / "User Q&A"，以及为什么这是一个纯文案改动、不能也不应该扩散到 DB / API / 内部命名。

详见 `proposal.md` 的 Why 段落。

## Goals / Non-Goals

**Goals:**
- 把两张 Q&A 卡片的对外标题统一改为 "Preset Q&A" 与 "User Q&A"
- 同步 `openspec/specs/qa-display-split/spec.md` 中所有引用旧名的 requirement / scenario
- 同步 `docs/frontend-architecture.md` 中引用旧名的架构示意图与说明段落
- 保持可读性，让用户能直观区分"系统预置 / 共享"与"用户主动 / 个人"

**Non-Goals:**
- 不修改 `qa_entries.type` 的取值（保留 `'template'` 与 `'free'`）— DB 字段是实现细节，改名收益不抵风险
- 不修改 API URL / query param（`auto_template_qa`）— 那是外部 API 用户的接口契约
- 不修改 store / composable 内部字段名（`qaData.template` / `qaData.free`、`templateEntries` / `freeEntries`）— 那是实现细节，对用户不可见
- 不修改历史 archive 中的 spec 快照 — 那是历史记录
- 不引入 tooltip / subtitle 等辅助说明（已在 Explore 阶段与用户确认不加 helper）

## Decisions

### Decision: 只改 UI 文案，不做 DB / API 兼容层

**Rationale:** 改名只发生在用户能看到的两个 `<h3>` 标题位置，DB / API 没有任何用户能直接看到的字符串依赖这两个英文术语。把 DB 字段从 `'template'` 改成 `'preset'` 会破坏现有数据、需要 migration、把外部 API 用户搞坏，收益为零。把 `auto_template_qa` query param 改名为 `auto_preset_qa` 同理。

**Alternatives considered:**
- *给旧名加 alias / 兼容层*: 过度设计。UI 文案改名不需要后端配合，DB / API / 内部命名都不会引用这两个字符串。
- *同时改 store 字段名 (`qaData.template` → `qaData.preset`)*: 改起来轻松，但属于纯实现细节重命名，对用户无任何感知收益，还会扩大 diff 面积。

### Decision: 不加 helper 文案 / tooltip

**Rationale:** 用户在 Explore 阶段确认"直接改名、不加 helper"。Preset 在英语里是常见词（preset filter / preset channel），与 Notes / Walkthrough 等现有英文 UI 标签风格一致。

**Alternatives considered:**
- *在卡片标题下加灰色 subtitle（如 "config.yml 预置的共享问题"）*: 用户已拒绝。
- *改用更白话的名字（Built-in / Custom、Shared / My）*: 用户最终选了 Preset / User。

## Risks / Trade-offs

- [外部链接或截图仍引用旧名] → 极低风险。OpenSpec spec 是仓库内唯一权威定义，文档同步后即自洽。
- [用户已经习惯旧名] → 风险极低。这是 UI 文案，含义比旧名更直观；如有疑问，文案本身就是自解释的（"Preset" 暗示系统预设、"User" 暗示用户主动输入）。
- [中英文混用导致混乱] → 当前卡片标题就是英文（与 Notes / Walkthrough 一致），不存在混用问题。

## Migration Plan

无 migration 需要 — 纯 UI 文案 + spec/文档同步：
1. 修改 `QAList.vue` 两处 `<h3>` 文字
2. 同步 `openspec/specs/qa-display-split/spec.md`（delta spec 在 archive 时合并）
3. 同步 `docs/frontend-architecture.md`
4. 视觉回归（手动跑 `bun run dev` 打开任一论文详情页确认两张卡片标题）

Rollback: revert 这三个文件的改动即可，无需数据迁移。
