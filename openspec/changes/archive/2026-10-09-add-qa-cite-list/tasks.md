## 1. 基础

- [x] 1.1 新增 `lib/cite-links.ts`（提取 `#cite:` 链接与 id 规范化，与后端 `extractCiteLinks` 规则一致），通过 `vue-tsc` 检查，并用临时脚本或测试用例核对重复 id、大小写、`CorpusId:` 前缀的处理
- [x] 1.2 新增 `composables/useS2Papers.ts`（模块级缓存、微任务批量合并、按 200 分块、失败不永久缓存），通过 `vue-tsc` 检查

## 2. 组件

- [x] 2.1 新增 `components/PaperRefList.vue`（items/sections/comment、行内容与各状态、In library 链接、S2 外链、无导入操作），通过 `vue-tsc` 检查
- [x] 2.2 在 `QAResultBody.vue` 正文下方加入默认折叠的「References · N」（仅 done 且有有效 cite 时显示，展开才挂载列表），在浏览器中验证 PaperDetail 与 `/qa` feed 的显示效果

## 3. Chip 回退

- [x] 3.1 修改 `MarkdownContent.vue`：列表外 id 经解析接口升级为 chip，卡片使用统一展示模型，textContent 不变；在浏览器中验证列表内 id 不发请求、列表外可解析的 id 显示卡片、解析不到的保持纯文本

## 4. 文档与验证

- [x] 4.1 更新 `docs/frontend-architecture.md`（引用列表、组件、chip 回退、批量解析）和 `docs/tech-stack.md`（新文件说明），确认 `docs/external-api.md` 无需变更
- [x] 4.2 运行 `vue-tsc` 与 `vite build`，并在运行中的应用里用一个带多个 `#cite` 的真实回答做端到端检查（Network 面板中只有合并后的 resolve 请求）

## 5. 实现中的调整

- [x] 5.1 cite 不依赖所属论文：`MarkdownContent` 所有 `#cite:` id 统一走解析接口，移除 `usePaperReferences`（`s2Url` 移入 `lib/cite-links.ts`）；同步 spec/proposal/`docs/frontend-architecture.md`；`vue-tsc` 通过
