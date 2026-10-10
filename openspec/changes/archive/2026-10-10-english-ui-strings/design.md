## Context

`packages/frontend/src` 中约 428 行面向用户的中文（盘点结果按文件列于本文末尾的"逐文件对照"）。侧边栏、`AppPage` 标题、部分 Settings 文案已是英文。这是一项纯文案替换，无逻辑变化。

## Goals / Non-Goals

**Goals:** 前端所有面向用户的文案为英文，术语与排版一致。

**Non-Goals:** 不做 i18n 框架 / 语言切换；不改后端错误信息、prompt、用户数据；不改代码注释（可顺手更新引用了旧中文标签的注释）；不改 `PaperDetail.vue` 中解析 papers.cool 摘要的正则（匹配全角冒号 `：`）；不改测试夹具中的中文。

## Decisions

### 排版
- **Sentence case**：只有首词首字母大写（"New token"、"Reset password"、"Copy page link"）。专有名词保持原样：Q&A、PDF、arXiv、Semantic Scholar、S2、doc2x、Codex、Deep Research、Kimi、MCP、Markdown、LaTeX、QA-N。
- 进行时与等待提示统一以 `…`（U+2026）结尾，不用 `...`。
- 引号统一英文双引号 `"…"`；全角冒号 `：` → `: `；全角括号 → 半角。
- 确认框写完整问句：先问动作，再说后果。如 "Revoke this token? Services using it will lose access immediately."
- 错误 / 提示句子以句号结尾；按钮、标签、tooltip、表头不加句号。
- 不在英文里保留中文标点；数字与单位之间用空格（"3 answers"）。复数按数量处理（`1 answer` / `2 answers`）——仅在已有数量变量处处理。

### 通用词汇表

| 中文 | 英文 |
|---|---|
| 保存 / 保存中… | Save / Saving… |
| 取消 | Cancel |
| 删除 / 删除中… | Delete / Deleting… |
| 编辑 | Edit |
| 关闭 | Close |
| 重试 | Retry |
| 提交 | Submit |
| 确认（对话框标题） | Confirm |
| 复制 / 已复制 | Copy / Copied |
| 移除 | Remove |
| 加载中… / 正在加载… | Loading… |
| 刷新 | Refresh |
| 生成 / 生成中… / 正在生成回答… | Generate / Generating… / Generating answer… |
| 一键生成 | Generate all |
| 生成失败 | Generation failed |
| 重新生成 | Regenerate |
| 重新提交 | Resubmit |
| 已完成 | Done |
| 全部展开 / 全部折叠 | Expand all / Collapse all |
| 标题 | Title |
| 作者 / 作者 (逗号分隔) | Authors / Authors (comma-separated) |
| 来源 / 来源链接 / 来源链接 (可选) | Source / Source URL / Source URL (optional) |
| 标签 / 添加标签 / + 添加标签 | Tags / Add tag / + Add tag |
| 摘要 | Abstract |
| 笔记 | Notes |
| 用户名 / 密码 / 昵称 | Username / Password / Nickname |
| 当前密码 / 新密码 / 初始密码 | Current password / New password / Initial password |
| 创建时间 | Created |
| 状态 / 操作 / 类型 / 时间 / 错误 | Status / Actions / Type / Time / Error |
| 管理员 / 普通用户 | Admin / User |
| 有效 / 已撤销 / 撤销 | Active / Revoked / Revoke |
| 签发 | Issue token |
| 高亮 | Highlight |
| 截图 | Screenshot |
| 选段 | Selection |
| 对话历史 | Conversation history |
| 提问（动作 / 窗口标题） | Ask |
| 自由提问（条目兜底标题） | Free question |
| 加入提问框 | Add to question |
| 追问 | Follow up |
| 对话视图 / 在对话视图中打开 | Conversation view / Open in conversation view |
| 新对话 | New conversation |
| 置顶 / 取消置顶 | Pin / Unpin |
| 参考文献 / 被引用 | References / Cited by |
| 引用 N（徽标） | N citations |
| 刚刚 / N分钟前 / N小时前 / N天前 | just now / Nm ago / Nh ago / Nd ago |
| 暂无 X | No X yet（列表空状态）/ No X（无可用项） |
| 上一页 / 下一页 / 放大 / 缩小 | Previous page / Next page / Zoom in / Zoom out |
| 网络错误，请检查连接 | Network error. Check your connection. |
| 登录 / 登录中… / 登录失败 | Log in / Logging in… / Login failed |
| 幻觉翻译（hjfy.top 站点） | hjfy.top |
| 对照翻译（doc2x） | Bilingual PDF |
| PDF 原文 | PDF |

### 逐文件对照（未在词汇表中的句子）

**api/client.ts**：网络错误… → 见词汇表；`QA 流连接失败` → "Q&A stream connection failed"；`登录失败` → "Login failed"。

**LoginDialog.vue**：登录 Paperland → "Log in to Paperland"；说明 → "Log in to add papers, use AI models, and manage your tags, questions and highlights."；请输入用户名和密码 → "Enter your username and password."

**MarkdownContent.vue**：alert 内容为空… → "Nothing to highlight."；已复制内容和锚点链接 → "Copied content and anchor link"；已复制锚点链接 → "Anchor link copied"；LaTeX 已复制到剪贴板 → "LaTeX copied"；打开论文 → "Open paper"；复制内容和锚点链接 → "Copy content and anchor link"；复制锚点链接 → "Copy anchor link"。

**PaperActionLauncher.vue**：收起 / 功能 → "Collapse" / "Actions"。

**FloatingWindow.vue**：拖动调整大小 → "Drag to resize"。

**PaperCitations.vue**：本文引用的论文 → "Papers this paper cites"；引用本文的论文 → "Papers citing this paper"；`X 等` → "X et al."；(无标题) → "(Untitled)"；共 N 条，显示前 M 条 → "Showing M of N"。

**PaperFullTextCopy.vue**：复制全文（直接解析）/（doc2x） → "Copy full text (basic parse)" / "Copy full text (doc2x)"；全文尚未就绪 → "Full text isn't ready"；已复制全文（N 字符） → "Copied full text (N characters)"；复制失败，请检查浏览器剪贴板权限 → "Copy failed. Check clipboard permissions."；全文 → "Full text"；解析完成后可用 → "Available after parsing"。

**PaperViewerPanel.vue**：暂无可用的查看模式 → "No view available"；等待服务下载 PDF 或补充 arXiv ID... → "Waiting for the PDF download or an arXiv ID…"。

**PdfUploadPanel.vue**：闭源论文… → "This paper isn't open access; Semantic Scholar has no open PDF for it."；自动下载失败… → "Automatic PDF download failed (the source refused access or didn't return a PDF)."；没有找到… → "No downloadable PDF source was found."；请选择 PDF 文件 → "Choose a PDF file."；上传失败 → "Upload failed"；正在获取 PDF… → "Fetching PDF…"；服务正在从… → "Downloading from arXiv / Semantic Scholar; it will appear automatically."；需要上传 PDF → "PDF needed"；上传后即可… → "Upload a PDF to read, parse and translate it."；上传中… / 选择 PDF 文件 → "Uploading…" / "Choose PDF"；或将 PDF 拖放到此处 → "or drop a PDF here"；登录后可上传 PDF → "Log in to upload a PDF"。

**Doc2xTranslationTab.vue**：doc2x 精确解析 已完成 / 进行中… / 排队中… / 失败 / 未开始 → "doc2x parse: done" / "doc2x parse: running…" / "doc2x parse: queued…" / "doc2x parse: failed" / "doc2x parse: not started"；重新解析 / 开始解析 → "Re-parse" / "Start parse"；左右对照 / 仅译文 → "Side by side" / "Translation only"；说明 → "Use doc2x to create a bilingual PDF that keeps the layout (references are not translated)."；开始翻译 → "Start translation"；翻译在等待 doc2x 解析，但解析失败了： → "Translation was waiting for the doc2x parse, but the parse failed: "；已排队… → "Queued; translation starts after the doc2x parse finishes…"；重新解析并翻译 → "Re-parse and translate"；翻译排队中… → "Translation queued…"；正在翻译，通常需要 1–3 分钟… → "Translating, usually 1–3 minutes…"；翻译失败： → "Translation failed: "。

**PdfViewer.vue**：已复制本页链接 → "Page link copied"；已复制翻译 → "Translation copied"；已复制选区链接 → "Selection link copied"；黄色 / 绿色 / 蓝色 / 粉色 → "Yellow" / "Green" / "Blue" / "Pink"；其他用户 → "Another user"；`X 的高亮` → "X's highlight"；高亮保存失败，请重试 → "Failed to save highlight. Try again."；删除高亮失败，请重试 → "Failed to delete highlight. Try again."；提问失败 → "Failed to ask"；截图上传失败，请重试 → "Screenshot upload failed. Try again."；已复制图片链接 / 已复制截图 Markdown → "Image link copied" / "Screenshot Markdown copied"；暂无 PDF → "No PDF yet"；等待 arxiv 服务下载... → "Waiting for the arXiv service to download it…"；PDF 加载失败 → "Failed to load PDF"；打开原始 PDF → "Open original PDF"；当前：适配宽度（点击切换为适配高度） → "Fit width (click for fit height)"，反之 "Fit height (click for fit width)"；复制本页链接 → "Copy page link"；框选截图模式（Esc 取消） → "Capturing — press Esc to cancel"；框选截图（截取一块区域并上传图床） → "Capture region (upload a screenshot to Images)"；复制图床图片链接 → "Copy image link"；复制图片链接 → "Copy image link"；复制带定位的 Markdown 图片链接 → "Copy Markdown image with anchor link"；复制 Markdown → "Copy Markdown"；用预设问题直接提问这张截图 → "Ask the preset question about this screenshot"；截图提问 → "Ask about screenshot"；`改为X高亮` / `X高亮` → "Change to x"（颜色小写） / "X highlight"；删除高亮 → "Delete highlight"；翻译选区 → "Translate selection"；翻译 → "Translate"；用预设问题直接提问这段内容 → "Ask the preset question about this selection"；加入提问框，可继续添加选段或截图后再提问 → "Add to question; you can add more selections or screenshots before asking"；复制选区链接 → "Copy selection link"；关闭翻译 → "Close translation"；复制翻译 → "Copy translation"；在列表中查看 → "Show in list"。

**QAConversationPanel.vue**：正在加载对话… → "Loading conversation…"；最后一个回答未成功完成…（失败或取消） → "The last answer didn't finish, so you can't follow up in this conversation"；最后一个回答完成后才能继续追问 → "You can follow up after the last answer finishes"；关闭此对话 → "Close this conversation"；关闭对话视图 → "Close conversation view"；空状态 → "Ask below to start a conversation, or click "Open in conversation view" on an answer in the Q&A list."

**QAEntryBackgroundPicker.vue**：淡灰色…淡红色 → "Gray" / "Brown" / "Orange" / "Yellow" / "Green" / "Blue" / "Purple" / "Pink" / "Red"；设置个人背景色 → "Set background color"；清除背景色 → "Clear background color"。

**QAFeedPanel.vue / QAList.vue / QATreeView.vue / QATreeNode.vue / QAThreadView.vue**：`已复制 QA-N 链接` → "QA-N link copied"；复制 QA 链接 → "Copy QA link"；`N 个回答` → "N answer(s)" 按数量单复数；暂无回答 → "No answers yet"；当前不可见 → "This Q&A isn't visible"；已删除 → "This Q&A was deleted"；Q&A 树（浮动窗口） → "Q&A tree (floating window)"；`关于「X」正在生成中，是否需要重新提交 M？` → `"X" is still generating. Resubmit M?`；`接续 QA-N 的回答` → "Follow-up to QA-N"；暂无 Q&A 记录 / 暂无 Q&A → "No Q&A yet"；`X\nQA-N · 点击在对话视图中打开` → "X\nQA-N · Click to open in conversation view"；无法加载该对话（问答不存在或不可见） → "Can't load this conversation (it doesn't exist or isn't visible)."；`QA-N 当前不可见或已删除` → "QA-N is hidden or deleted"；在列表中定位 → "Show in list"；该回答已删除 → "This answer was deleted"。

**QAInput.vue / QAInputSummary.vue / useQAWindow.ts / lib/qa-content.ts / stores/qa.ts**：模型 → "Model"；`追问 QA-N · …` → "Following up on QA-N · …"；取消追问 → "Cancel follow-up"；新对话：提交后创建新的提问 → "New conversation: submitting starts a new question"；不支持图片输入… → "This model can't take images. Pick a model that supports images."；placeholder → "Ask a question; @ to reference a selection or screenshot…"；登录后可对论文提问 → "Log in to ask about this paper"；需要先解析 PDF 或提供全文才能提问 → "Parse the PDF or provide the full text before asking"；doc2x 未完成确认框 → "The doc2x parse isn't finished, so this answer will use the basic text extraction (formulas and tables may be inaccurate).\n\nAsk anyway?"。

**QAModelInputDialog.vue**：加载失败 → "Failed to load"；按当前配置重建… → "Rebuilt from the current config; it may differ from what was actually sent."；字符（全文不展开） → "characters (full text not expanded)"。

**QAReadingIndicators.vue**：`高亮 N` → "N highlight(s)"；`笔记引用 N` → "N note reference(s)"（按数量单复数）。

**QAResultBody.vue**：已复制回答链接 → "Answer link copied"；回答完成后才能追问 → "Available after the answer finishes"；复制回答链接 → "Copy answer link"；查看模型输入 → "View model input"。

**ReferenceLinksSection.vue**：请填写链接 → "Enter a link."；请填写有效的 http(s) 链接 → "Enter a valid http(s) link."；保存失败 → "Failed to save"；确认删除参考链接「X」？ → `Delete the reference link "X"?`；参考链接 → "Reference links"；https://...（必填） → "https://… (required)"；标题（可选…） → "Title (optional; leave blank to use the fetched description)"；正在获取描述… → "Fetching description…"；无法自动获取描述… → "Couldn't fetch a description (the site may block it); enter a title manually."；+ 添加链接 → "+ Add link"。

**TagSelector.vue**：`移除 X` → "Remove X"；搜索或创建标签... → "Search or create a tag…"；`创建 "X"` → `Create "X"`。

**settings/AccountSettings.vue**：重新生成确认 → "Regenerate the token? The old token in the browser extension will stop working and must be replaced."；Token 已重新生成 → "Token regenerated"；撤销确认 → "Revoke this token? Services using it will lose access immediately."；Codex 重置确认 → "Reset the Codex agent token? The old one stops working at once; tool calls in running Deep Research rounds will fail, and new rounds use the new token."；Codex agent token 已重置 → "Codex agent token reset"；修改密码需要输入当前密码 → "Enter your current password to change it."；没有需要保存的修改 → "No changes to save."；账户已更新 → "Account updated"；更新失败 → "Update failed"；说明 → "Change your username, nickname or password. Changing the password requires your current one."；留空则显示用户名 → "Leave blank to show your username"；昵称说明 → "Others see your nickname in lists; it doesn't have to be unique."；留空则不修改密码 → "Leave blank to keep your password"；Sharing 说明 → "Data types you turn on appear (read-only) in other users' "All" lists. Admins can always see everything, and published notes are always listed. Papers and preset questions are always shared; tags and images are always private."；API Tokens 说明 → "Use these to access Paperland from other tools: the External API (e.g. the Zotero plugin) and the MCP server. Send as `Authorization: Bearer <token>`."；新 token（只显示这一次，请立即复制） → "New token — shown only once, copy it now"；还没有 personal token。 → "No personal tokens yet."；Deep Research 自动使用，不可查看。 → "Used automatically by Deep Research; cannot be viewed."；插件说明 → "Enter this URL and token in the extension's options to open papers from arXiv / Hugging Face / alphaXiv in one click."

**settings/InstallAppCard.vue**：可安装说明 → "Install Paperland as an app in its own window, opened from your desktop, Dock or home screen."；手动 → "Your browser has no one-click install. To install manually:"；Chrome / Edge: "click the install icon in the address bar"；Safari (macOS): "File → Add to Dock"；Safari (iOS / iPadOS): "Share → Add to Home Screen"。

**views/PaperDetail.vue**：论文详情（页面标题兜底） → "Paper Detail"（与路由 meta 及 page-title spec 一致）；双栏 / 论文 + 对话 / 三栏 → "Two columns" / "Paper + conversation" / "Three columns"；内容 (User Input) → "Content (user input)"；输入论文内容... → "Enter paper content…"；加入中… / 加入列表 → "Adding…" / "Add to list"；Kimi 自动摘要 → "Kimi summary"；刷新页面 → "Reload page"；页面布局 → "Page layout"；拖动调整对话栏宽度 → "Drag to resize the conversation panel"；删除论文 → "Delete paper"；你确定要删除论文 X 吗？ → `Delete the paper "X"?`；不可撤销说明 → "This cannot be undone. All Q&A entries, answers, service runs, tag links, and highlights of this paper will be permanently deleted."；请输入论文内部 ID … 以确认删除： → "Type the paper's internal ID … to confirm:"；输入论文 ID → "Paper ID"；确认删除 → "Delete permanently"。

**views/PaperList.vue**：添加论文 → "Add paper"；搜索论文标题、摘要... → "Search titles and abstracts…"；最近修改 / 添加时间 / 添加日期 → "Last modified" / "Date added" / "Date added"；全部 / 仅元数据 / 已列出 → "All" / "Metadata only" / "Listed"；仅元数据（待添加） → "Metadata only (not added)"；标签筛选 / 清除筛选 → "Filter by tag" / "Clear filters"；精读完成 · 打开笔记 / 有笔记 · 打开笔记 / 暂无笔记 · 打开笔记 → "Done reading · Open notes" / "Has notes · Open notes" / "No notes · Open notes"；抓取中… / 抓取 → "Fetching…" / "Fetch"；暂无论文 → "No papers yet"；手动输入 → "Manual"；例: 1706.03762 → "e.g. 1706.03762"；无法识别… → "Not recognized. Enter a Corpus ID, a 40-character S2 paper ID, or a Semantic Scholar paper URL."；例: 13756489、… → "e.g. 13756489, CorpusId:13756489, 204e3073…b72e776, or a paper page URL"；论文内容... → "Paper content…"；添加中... / 添加 → "Adding…" / "Add"。

**views/QAPage.vue**：暂无自由提问记录 → "No questions yet"；在论文详情页中提交自由提问 → "Ask questions from a paper's detail page"。

**views/ServiceDashboard.vue**：`已入队 N 篇论文的 S2 回填` → "Queued S2 backfill for N papers"；回填失败 → "Backfill failed"；重试失败 → "Retry failed"；回填 S2 数据 → "Backfill S2 data"；并发 → "Concurrency"；排队 → "Queued"；执行历史 → "Run history"；全部服务 / 全部状态 → "All services" / "All statuses"；服务 / 论文 → "Service" / "Paper"。

**views/Settings.vue**：用户已创建 → "User created"；`已将 X 设为管理员/普通用户` → "X is now an admin" / "X is now a user"；请输入新密码 → "Enter a new password."；密码已重置 → "Password reset"；昵称已更新 → "Nickname updated"；用户管理 → "User management"；新增用户 → "Add user"；改为普通 / 设为管理员 → "Remove admin" / "Make admin"；昵称（按钮） → "Nickname"；重置密码 → "Reset password"；暂无用户 → "No users"；新 Token 已生成（仅显示一次） → "New token created (shown only once)"；不可查看 → "Hidden"；Codex agent 徽标 title → "One per user, used by Codex in Deep Research; only its owner can reset it"；暂无 Token → "No tokens"；新增用户说明 → "Create an account with an initial password. The user can change it after logging in."；创建中… / 创建用户 → "Creating…" / "Create user"；修改昵称 → "Edit nickname"；`为 X 设置昵称，留空则显示用户名。` → "Set a nickname for X. Leave blank to show the username."；`为 X 设置一个新密码。` → "Set a new password for X."

## Risks / Trade-offs

- [Spec 漂移] 现有 spec 用中文写了具体按钮名 → 以 delta 同步改为英文；纯中文叙述（不规定界面文案）的 spec 不改。
- [遗漏] → 完成后再次 grep CJK 字符，仅允许注释、正则、测试夹具中的残留。
- [与其他 agent 并发改同一文件] → 只做字符串替换，逐文件编辑，不重排代码。
