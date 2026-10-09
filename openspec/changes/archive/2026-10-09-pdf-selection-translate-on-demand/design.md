## Context

`PdfViewer.vue` 目前有两条独立的选区管线：60ms 防抖后显示「复制选区链接」浮钮（仅 `paperId` 存在时），以及 `StableSelectionIntent` 的 500ms 计时器自动激活翻译浮层。翻译浮层本身（`placeSelectionPanel` 定位、`StreamingTranslationText`、复制/重试/关闭、pointer ownership、Range 恢复）工作正常，需要保持不变。

## Goals / Non-Goals

**Goals:** 去掉自动触发；把复制链接浮钮升级为选区工具栏（样式对齐 `MarkdownContent` 的 `.hl-toolbar`），增加「翻译」按钮作为唯一触发入口。

**Non-Goals:** 不改翻译浮层 UI、定位算法、后端翻译接口与缓存；不改 Markdown 划线工具栏。

## Decisions

- **工具栏替代单个浮钮**：`showSelBtn` → `showSelToolbar`，在 `paperId` 存在或登录时显示；按钮：`翻译`（仅登录）+ `复制选区链接`（仅 `paperId`）。按钮保留 `@mousedown.prevent` 以免点击清除原生选区。位置沿用 `selBtnPos`（选区下方 6px，`translateX(-50%)`），因此 `placeSelectionPanel` 的 `copyActionHeight` 预留仍成立。
- **点击即激活**：`translateSelection()` 直接对 `currentSelection` 调用既有 `activateTranslation`（若同一 identity 已激活则 no-op）。删除 `StableSelectionIntent` 类、`dismissedTranslationIdentity`（只为防止自动重开而存在）及相关测试。
- **新选区关闭旧浮层**：`handleSelectionSettled` 中若 `activeTranslation` identity 与新 snapshot 不同，则 `closeTranslationPanel()`；外部手势 settle 判定沿用 `decideOutsidePanelSelection`（`keep_for_replacement` 只表示「交给 handleSelectionSettled 处理新选区而非整体隐藏」）。
- **工具栏 pointer ownership**：工具栏按钮已用 `mousedown.prevent` 保留选区；点击「翻译」时 pointerdown 落在工具栏上，此时尚无 activeTranslation，`onDocumentPointerDown` 直接返回，无副作用。若浮层已开，点击工具栏（如复制链接）会被视作 outside —— 复制链接本就会关闭一切，可接受；点击「翻译」同一 identity 时 pointerup 后 settle 读到同一选区 → `dismiss`，会误关浮层。因此工具栏在 pointerdown 时也视为 owner（与面板同等处理）。

## Risks / Trade-offs

- [用户习惯自动翻译] → 一次点击成本低；按钮紧贴选区下方。
- [移动端工具栏与原生选区菜单重叠] → 与 Markdown 工具栏现状一致，可接受。
