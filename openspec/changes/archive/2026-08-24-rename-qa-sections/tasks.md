## 1. Update UI labels in QAList.vue

- [x] 1.1 把 `packages/frontend/src/components/QAList.vue` 第 180 行 `<h3>` 标题从 "Template Q&A" 改为 "Preset Q&A"
- [x] 1.2 把同一文件第 267 行 `<h3>` 标题从 "Free Q&A" 改为 "User Q&A"
- [x] 1.3 同步更新第 176 / 263 行的 HTML 注释（`<!-- Template Q&A Card -->` / `<!-- Free Q&A Card -->`）保持注释与标题一致

## 2. Sync docs and architecture diagram

- [x] 2.1 在 `docs/frontend-architecture.md` 架构示意图（第 235 / 238 行附近的 ASCII art）中把 `Template Q&A` / `Free Q&A` 替换为 `Preset Q&A` / `User Q&A`
- [x] 2.2 在 `docs/frontend-architecture.md` 第 321 / 322 行附近的卡片说明段落中同步替换

## 3. Validate and archive

- [ ] 3.1 运行 `openspec validate rename-qa-sections --strict` 确认 change 包通过校验
- [ ] 3.2 启动 `bun run dev`，打开任意论文详情页，确认右侧两张卡片分别显示 "Preset Q&A" 与 "User Q&A"
- [ ] 3.3 运行 `/opsx:archive rename-qa-sections`，按提示选择 Sync now（合并 delta spec 到主 spec）
- [ ] 3.4 Archive 完成后按 CLAUDE.md 的 commit 规则创建独立 commit 并推送至 `origin/main`
