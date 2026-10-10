## 1. Specs 与准备

- [x] 1.1 为规定了中文 UI 文案的现有 spec 写 delta（文案改为英文）

## 2. 前端文案替换（按 design.md 对照表）

- [x] 2.1 基础与通用：`api/client.ts`、`LoginDialog.vue`、`MarkdownContent.vue`、`FloatingWindow.vue`、`PaperActionLauncher.vue`、`TagSelector.vue`、`lib/qa-content.ts`、`composables/useQAWindow.ts`、`stores/qa.ts`
- [x] 2.2 PDF / 阅读器：`PdfViewer.vue`、`PaperViewerPanel.vue`、`PdfUploadPanel.vue`、`Doc2xTranslationTab.vue`、`PaperFullTextCopy.vue`、`PaperCitations.vue`、`ReferenceLinksSection.vue`
- [x] 2.3 Q&A：`QAList.vue`、`QAInput.vue`、`QAInputSummary.vue`、`QAResultBody.vue`、`QAConversationPanel.vue`、`QAFeedPanel.vue`、`QAThreadView.vue`、`QATreeNode.vue`、`QATreeView.vue`、`QAEntryBackgroundPicker.vue`、`QAModelInputDialog.vue`、`QAReadingIndicators.vue`、`views/QAPage.vue`
- [x] 2.4 页面：`views/PaperDetail.vue`、`views/PaperList.vue`、`views/ServiceDashboard.vue`、`views/Settings.vue`、`components/settings/AccountSettings.vue`、`components/settings/InstallAppCard.vue`

## 3. 文档与验证

- [x] 3.1 更新 `docs/` 中引用的界面文案（`frontend-architecture.md` 等；`tech-stack.md`、`external-api.md` 如有）
- [x] 3.3 在 `AGENTS.md` Key Conventions 中新增 "UI text is English" 约定
- [x] 3.2 CJK grep 复查（仅注释 / 正则 / 测试夹具可残留）、`vue-tsc`、`bun run build:frontend --out-dir <scratch>`
