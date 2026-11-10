# Paperland External API

## Topics 与 agent 协作

Topics 的仓库文件格式、用户身份、MCP/Git 凭证与接口见 [Topics 仓库与接口约定](topics.md)。Topic 凭证同时绑定专题和实际用户，Git 推送审计不依赖提交中自行声明的作者；调用次数按用户与可选 Topic 聚合，不按 token 聚合。普通 External API 继续只接受 personal token。

网站新增 `PATCH /api/topics/:id`，owner/editor 提交 `{title,base_commit}` 改名，过期基准为 409；改名保留论文清单/报告与标签身份并进入 Git 历史。旧 Research 的一次性迁移脚本保留完整结果版本和 URL 引用，不执行远程抓取。迁移中的 Topic 不暴露内容/标签，完成后继承所属账号和已共享读者；正常 External API 契约不受影响。

Topic 创建接受 `default_access: "none"|"viewer"|"editor"`（默认 none），owner 通过 `PUT /api/topics/:id/sharing {default_access}` 更新；个人 grant 与默认按 `none < viewer < editor` 取较高者，删除个人授权回到默认。`GET members` 区分个人 `role` 和 `effective_role`。Public 仅对 active 登录账号开放。Share/Connect 拆分属于 UI，权限仍由 web/MCP/Git 同一服务校验。

`GET /api/topics/:id` 与 MCP `get_topic` 增加 `documents`（path/title/body/references/exists）、`reference_numbers`（稳定条目 ID→编号）、`next_reference_number`；原始 snapshot 保留 frontmatter 和可选 pages。`papers.json` 是全局资料表，条目可声明 `reference_number`，文档 frontmatter 只含编号子集。新编号按首次进入 Topic 的提交顺序保留，删除不复用；不按发表年份排序。无效中间文档或引用使整个 push 失败。增补 MCP `set_topic_sharing`，仍需 personal token 与 owner 权限。正常 External API 契约不变。

`get_topic` 可选 `document: "pages/rq6.md"` 仅读该文档及其编号引用，或 `metadata_only: true` 省略所有页面正文，避免长 Wiki 重复返回全文；不传参数保留完整兼容结构。文档路径仍受 Topic/历史权限限制，不能读取任意仓库路径。

v2 仓库必需 topic.json、references.json、pages/report.md；页面可以嵌套并有 title/fonticon/references frontmatter。其他安全文件是 Git 工作区，MCP/网页不会将其当作报告；AGENTS.md 作为指南例外读取。get_topic 现在给出 home_page、文档 slug/url、实际配置的资源 limits 和图标名清单；document 可选 pages/**/*.md 或 AGENTS.md，metadata_only 省略正文。干净文档 URL 不带 file 查询或 .md，历史仍用 version 查询。旧 v1 历史与查询链接兼容，普通 External API 契约不变。


Topic detail 新增 paper_importable（entry ID→boolean），用于引用卡片/列表明确判断可导入条目。POST /api/topics/:id/import 继续使用原 {entry_id,commit?} 和 ACL，除 S2 外支持明确 arxiv.org abs/pdf/html 论文链接（现代/旧式 ID，去除版本号用于站内规范化去重）；保留 Git 中固定版本的 URL、编号与报告。其他项目链接不因此触发抓取/入库。返回后的原地卡片更新/引用折叠属于 UI，无新的普通 External API 端点或凭证权限。


Topic文章树的桌面加宽与紧凑间距仅为前端布局调整；文件路径、title/fonticon、API/MCP字段、权限及引用格式不变。

## 概述

`/qa` 的响应式卡片、独立 Questions/Highlights 范围控件和分页/空状态仅属站内展示；继续复用既有 `GET /api/qa/free` 分页数据、权限与流式回答，不新增或改变 External API/MCP 的端点、字段或鉴权。

External API 是独立于前端 Internal API 的第三方接口，主要用于 Zotero 插件等外部服务与 Paperland 进行数据同步。

生产入口为 `https://paperland.dev.mem.ac/external-api/v1`：Caddy 将整个站点转发到仅监听 `127.0.0.1:3000` 的后端，后端同时托管前端构建产物。开发入口仍经 Vite 5173 转发。此次托管调整不改变 Bearer Token 认证或接口契约；未知 External API 路径继续返回错误，不能落入前端 SPA 的 HTML 回退。

文本翻译、PDF 选区工具栏按需划词翻译及其流式测试页属于网站登录态的 Internal API/UI：`POST /api/translate`、`POST /api/translate/stream`、PDF text-layer selection panel 和 `/translation-test` **不在** `/external-api/v1` 下，也不接受 Bearer API Token。`/translation-test` 仅管理员可直接访问且不显示在侧边栏；PDF 划词翻译仅在登录用户点击选区工具栏 "Translate" 后触发，匿名选择不请求 API。面板内焦点转移、外部点击关闭、新选区关闭旧浮层，以及等待首个译文时显示所选原文的 UI fallback，均是 Internal UI 生命周期/呈现行为，不增加请求字段或端点。本次 PDF 选区功能不改变任何 External API 请求或响应契约。

浏览器插件的「快捷打开」同样属于网站登录态的 Internal API，**不在** `/external-api/v1` 下、不接受 Bearer API Token：`GET /api/auth/open-token`（获取当前用户的快捷打开 CSRF token，首次请求时生成）、`POST /api/auth/open-token/regenerate`（重新生成，旧 token 立即失效）、`POST /api/papers/open-arxiv { arxiv_id, token }`（需会话 + token 匹配，否则 401 / 403 `INVALID_OPEN_TOKEN`；id 不可解析为 422；成功返回 `{ paper_id, arxiv_id, created }`）。arxiv id 会去掉 `arXiv:` 前缀与版本号后再查找/存储。该 token 与 External API Token 相互独立，不能用于调用 External API。插件下载 `GET /api/extension/download?base_url=<http(s) 绝对 URL>` 同样是 Internal API：需登录（401），`base_url` 非法时返回 422，成功时返回 `application/zip`（`paperland-extension-<version>.zip`），其中内置 `src/preset.json`（`base_url` + 当前用户的 token）。详见 `browser-extension.md`。

S2 论文元数据缓存的解析接口 `POST /api/s2/papers/resolve` 同样属于 Internal API，**不在** `/external-api/v1` 下、不接受 Bearer API Token；新增的 `s2_papers` 缓存表不改变任何 External API 请求或响应契约。

Deep Research（`/api/research/*`，研究会话、步骤、标题编辑、回退与 SSE）同样只是 Internal API（会话认证），External API 不暴露 research 数据；新增的 `research_sessions` / `research_steps` 表与 `research` 共享类型不改变任何 External API 契约。

完成通知（`GET /api/notifications/completions`，当前用户自己完成的 QA 回答 / 研究回合，前端轮询用）同样只是 Internal API（会话认证），不改变 External API。

### MCP 服务器（`/mcp`）

`POST /mcp` 是 Paperland 的 MCP 服务器（只读工具 + `upload_image` + 论文写工具）（Streamable HTTP、无状态 JSON-RPC，直接返回 `application/json`），不在 `/external-api/v1` 下，但鉴权方式相同：`Authorization: Bearer <token>`，接受 **personal、agent 与 topic** 三种 token（topic 另验证绑定专题及当前成员权限），按 token 所属用户的身份和可见性执行工具；任何来源都可访问（含经反向代理），未携带、无效、已撤销、无属主或属主账号非 active 的 token 返回 401。在其他 MCP 客户端里配置 URL `https://<站点>/mcp` 和自己的 personal token 即可使用；Deep Research 回合由后端自动注入会话所有者的 agent token，Codex QA 回合注入提问者的 agent token（只开放 `upload_image`）。`upload_image` 上传图片或视频（PNG / JPEG / GIF / WebP / MP4 / WebM）到图床并返回可嵌入的 Markdown（视频同样是 `![alt](url)`，Article 视图里内联播放）：`url`（服务端下载，规则同下方 `POST /external-api/v1/images?url=`）、`data`（base64 或 data URL，只适合很小的图）、`path`（服务器本地路径，只对 agent token 开放），三选一。只读工具 `get_skill(name?)` 返回内置 agent 指南（不带 name 时列出，如 `blog-import`：如何把博客导入为文章）。工具清单见 `tech-stack.md`「Agent 工具（MCP）」。

**论文写工具（只接受 personal token；agent token 调用返回工具错误，Deep Research / QA 回合也看不到它们）**：让自己的 agent 添加和维护论文，校验与副作用与站内接口相同。

| 工具 | 参数 | 说明 |
|---|---|---|
| `add_paper` | `arxiv_id` / `corpus_id` / `s2_paper_id`，或 `title`（必填）+ `authors`、`link`、`abstract`、`year`、`venue`、`kind`（`paper` / `article`，后者即博客）、`published_at` / `modified_at`（ISO 8601 日期或时间，源站发布 / 最后更新时间）、`content`（Markdown 正文）、`pdf_url`、`pdf_data`（base64 或 `data:application/pdf;base64,…`）、`tags` | 新建或命中已有论文（id 去重；无 id 的手动论文按规范化 link 去重），加入调用者的列表；新建时打上调用者的标签。`pdf_url` 由 `url_pdf_service` 下载，`pdf_data` 直接存为 PDF。返回 `paper_id`、`created`、元数据、`app_link`、`pdf_status` |
| `update_paper` | `paper_id` + 上述元数据字段 | 同 `PATCH /api/papers/:id`（arXiv 论文 title/authors 锁定，空字符串清空 abstract / venue / pdf_url） |
| `upload_paper_pdf` | `paper_id` + `data` 或 `url`（二选一），`replace?` | `data` 同 `POST /api/papers/:id/pdf`；`url` 写入 `pdf_url` 并下载（arXiv 论文不接受 `url`）。已有 PDF 时须 `replace: true`，内容不同则切换文件并重新生成解析 / 翻译 |
| `refresh_paper` | `paper_id`，`pdf?`、`s2?` | 手动重新抓取 PDF（arXiv 给最新版本）/ 刷新 S2 引用数据，后台运行，返回已排队的服务与各自的错误 |

`/mcp` 的请求体上限取图床 `max_size_mb` / `max_video_size_mb` 与 `pdf_upload.max_file_size_mb` 中最大者的 base64 体积。导入博客：先 `get_skill("blog-import")`，按指南抽正文、截图 / 上传图与视频，再 `add_paper({ kind: "article", link, published_at, modified_at, content, … })`。示例：添加一个只有项目主页和 PDF 的工作——`add_paper({ title: "Code Video Model", link: "https://code-video-model.github.io", venue: "Tech report", pdf_url: "https://code-video-model.github.io/tech_report.pdf" })`。

---

## 用户姓名展示

网页中普通用户可见的其他用户姓名（包括首页排行榜、共享列表和悬停提示）仅显示 nickname；未设置昵称时回退到 username。共享资源已有的 display_name 遵循这一规则；本次 UI 调整不删除或更改 API 的 username 字段、认证标识和响应结构。

## 认证

### 获取 Token

每个用户都可以在 **Settings** 页（侧边栏 Settings 或账户菜单 → Account settings）的 **API Tokens** 卡片管理**自己的** personal token：列表只显示掩码，新建时完整值**只显示一次**，可随时撤销。管理员另可在同一页面下方的 Administration → All API Tokens 查看全站 token、为自己签发和撤销 personal token。复制后配置到第三方服务中。

对应的 Internal API（会话登录，只能操作自己的 token）：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/me/tokens` | `{ data: { personal: [{ id, token(掩码), created_at, revoked_at }], agent: { created_at, rotated_at } } }` |
| POST | `/api/auth/me/tokens` | 新建 personal token，201 `{ data: { id, token(完整值，仅此一次), created_at } }` |
| DELETE | `/api/auth/me/tokens/:id` | 撤销自己的 personal token；不是自己的或不是 personal → 404 |
| POST | `/api/auth/me/agent-token/reset` | 原地重置自己的 Codex agent token，旧值立即失效；只返回 `{ data: { created_at, rotated_at } }` |

### Token 类型

`api_tokens.kind` 区分 personal / agent / topic 三种 token；前两者格式是 `sk-` + 64 位十六进制，topic 使用 `plt_` + 64 位十六进制并仅存 verifier：

- **personal**（默认，所有既有 token）：用户自己管理，**External API 与 MCP（`/mcp`）都可用**。
- **topic**：成员自己的专题凭证，绑定用户和 Topic，适用于该专题的 MCP / Git，不适用于普通 External API；在 Topic 页面管理，不显示在全站 personal/agent token 表。详见 [topics.md](topics.md)。
- **agent**（Codex agent token）：每个用户恰好一个，自动创建，供 Paperland 在 Deep Research 回合里注入自己拉起的 Codex 使用。**只有 `/mcp` 接受**，调用 External API 返回 401；任何接口都不返回它的值（管理员列表里 `token` 为 `null`、不可撤销），只能由本人重置。

### 使用 Token

所有 External API 请求需在 Header 中携带 Token：

```
Authorization: Bearer <token>
```

未携带或 Token 无效 / 已撤销，或使用 agent token 时，返回 `401 Unauthorized`。

> 网站的登录墙（未登录的 `/api/*` 一律 401）与自助注册审核只作用于网站 Internal API，**不影响** External API：`/external-api/*` 仍只认 Bearer Token。

### Token 的用户归属

每个 Token 归属一个用户（签发它的管理员，或指定用户）。以该 Token 调用 External API 时，请求**按其归属用户**操作：因此通过 Token 创建 / 同步的**标签**等按用户私有的数据，归该用户所有，与其他用户的数据相互隔离。升级到用户系统前已存在的 Token 一律迁移归属到初始 `admin` 用户，**Zotero 等既有集成无需改动即可继续工作**。归属用户不是 active 状态（如待审核的注册账号）时，其 Token 调用 External API 返回 401（与 `/mcp` 一致）；没有归属用户的老 Token 仍可使用。

External API 只涉及论文（始终全站共享）与标签（始终私有），不暴露高亮、笔记、Free Q&A、参考链接等「用户可选共享」数据，因此不受 Account → Sharing 开关影响（多用户可见性规则见 `frontend-architecture.md` §5.3）。

---

## API 端点

Base URL: `/external-api/v1`

---

### 论文相关

#### POST /papers

创建论文条目。如果论文已存在（依次按 arxiv_id → corpus_id → s2_paper_id 匹配），则绑定到已有记录并补充缺失的 ID。

若 Token 绑定了用户，论文（新建或已有）会加入该用户的个人论文列表（网站的 Mine 视图）。External API 的论文查询（`GET /papers` 等）仍返回全站论文，不按个人列表过滤。

**Request Body:**

```json
{
  "arxiv_id": "2401.12345",       // 可选
  "corpus_id": "123456789",       // 可选，也接受 "CorpusId:123456789" 或 S2 链接
  "s2_paper_id": "204e3073870fae3d05bcbc2f6a8e263d9b72e776",  // 可选，40 位十六进制 S2 paperId，也接受 semanticscholar.org 论文链接
  "title": "Paper Title",         // 可选，手动创建时必填
  "authors": ["Author A", "Author B"],  // 可选
  "link": "https://example.com/paper",  // 可选，论文来源链接
  "tags": ["tag1", "tag2"]        // 可选，同时同步标签
}
```

- `arxiv_id`、`corpus_id`、`s2_paper_id` 至少提供一个，或提供 `title` 进行手动创建
- S2 标识会在服务端规范化：`s2_paper_id` 转小写并校验为 40 位十六进制；`corpus_id` 接受纯数字或 `CorpusId:<n>`；任一字段传入 semanticscholar.org 链接（`/paper/[<slug>/]<paperId>` 或 `/CorpusID:<n>`）都会被解析到对应字段。无法识别 → `422 VALIDATION_ERROR`
- 仅凭 `s2_paper_id` 创建的论文由 `semantic_scholar_service` 直接用 paperId 查询 S2，异步补全 `corpus_id` / `arxiv_id` 与引用富化
- 创建/绑定成功后自动触发对应的 fetch services

**Response:**

```json
{
  "id": 42,
  "arxiv_id": "2401.12345",
  "corpus_id": "123456789",
  "title": "Paper Title",
  "authors": ["Author A", "Author B"],
  "tags": ["tag1", "tag2"],
  "created": true,           // true=新建, false=绑定到已有
  "created_at": "2026-03-18T10:00:00Z",
  "updated_at": "2026-03-18T10:00:00Z"
}
```

#### GET /papers/:id

获取论文详情。

**Response:**

```json
{
  "id": 42,
  "arxiv_id": "2401.12345",
  "corpus_id": "123456789",
  "title": "Paper Title",
  "authors": ["Author A", "Author B"],
  "tags": ["tag1", "tag2"],
  "abstract": "...",
  "created_at": "2026-03-18T10:00:00Z",
  "updated_at": "2026-03-18T10:00:00Z"
}
```

#### PATCH /papers/:id

更新论文信息。仅更新请求中提供的字段。

**Request Body:**

```json
{
  "title": "New Title",           // 可选，arXiv 论文不可修改
  "authors": ["Author A"],        // 可选，arXiv 论文不可修改
  "link": "https://example.com",  // 可选
  "content": "论文内容文本",        // 可选，写入 contents.user_input
  "abstract": "…",                // 可选，空字符串清空
  "year": 2026,                   // 可选，四位整数或 null，写入 metadata.year
  "venue": "Tech report",         // 可选，空字符串清空，写入 metadata.venue
  "kind": "article",              // 可选，"paper" | "article"（网页文章）
  "pdf_url": "https://…/a.pdf",   // 可选，http(s)，空字符串清空，写入 metadata.pdf_url
  "published_at": "2026-10-12",   // 可选，源站首次发布时间（ISO 8601 日期或时间），null / 空字符串清空
  "modified_at": "2026-10-13",    // 可选，源站最后更新时间，同上
  "listed": true                  // 可选，加入列表(true)/降为仅元数据(false)
}
```

- 与站内 `PATCH /api/papers/:id` 共用同一实现（`services/paper_actions.ts#updatePaperFields`）
- `kind` / `year` / `pdf_url` 非法时返回 `422 VALIDATION_ERROR`、日期非法时返回 `422 INVALID_DATE`，论文不变；arXiv 论文的 `published_at` / `modified_at` 由 arXiv 元数据（`<published>` / `<updated>`）维护；给没有 PDF 的已列出非 arXiv 论文设置 `pdf_url` 会调度 `url_pdf_service`
- arXiv 论文（有 `arxiv_id`）尝试修改 `title` 或 `authors` 时返回 `400`
- `content` 为空字符串时清除 `user_input`；`kind` 为 `article` 时正文的标题级别会被重排为从 `#` 开始的连续级别
- 成功更新后 `updated_at` 自动刷新
- `listed: true` 时把论文加入列表并触发完整抓取管线；`listed: false` 始终允许（降为仅元数据）

**Response:** 返回更新后的论文对象（同 GET /papers/:id 格式）。

#### DELETE /papers/:id

彻底删除论文及所有关联数据。在单个事务中级联删除：qa_results（含已软删除的回答）→ qa_entries → service_executions → paper_tags → highlights → paper。

**Response:**

```json
{
  "success": true,
  "deleted_id": 42
}
```

删除后 ID 不复用。论文不存在时返回 `404`。

#### GET /papers?arxiv_id=xxx / ?corpus_id=xxx / ?s2_paper_id=xxx

按外部 ID 查询论文。

**Response:**

```json
{
  "paper": {                    // 找到时返回论文对象
    "id": 42,
    "arxiv_id": "2401.12345",
    ...
  }
}
```

未找到时返回 `404`。

> 注：本 API 无"全量列表"端点，仅按 ID 精确查询。"Metadata only" 论文（`listed=0`，尚未加入阅读列表）也会被 lookup 命中（它们确已在库中、用于去重），但不会出现在站内论文列表里，直到被显式 "Add to list"。

#### GET /papers/full

获取论文所有信息（包括 Q&A、Service 执行历史）。同步接口，开启 `auto_create` 或 `auto_template_qa` 时会等待所有操作完成后再返回（长 timeout）。

**查询方式（四选一）：**

| 参数 | 说明 |
|------|------|
| `?id=42` | 按内部 ID 查询 |
| `?arxiv_id=2401.12345` | 按 arXiv ID 查询 |
| `?corpus_id=123456789` | 按 corpus ID 查询 |
| `?s2_paper_id=204e30…` | 按 S2 paperId 查询（同样接受 S2 链接） |

**可选参数（仅 arxiv_id / corpus_id / s2_paper_id 查询时生效）：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `auto_create` | `false` | 论文不存在时自动创建并触发抓取 |
| `auto_template_qa` | `false` | 自动执行缺失的模板提问（已有结果的跳过） |
| `exclude` | (无) | 排除指定字段，逗号分隔。如 `exclude=contents,services` |

**注意事项：**
- `auto_create=true` 时按所提供的 arxiv_id / corpus_id / s2_paper_id 创建并触发抓取。`semantic_scholar_service` 现在是**双向**的：带 arxiv_id 的论文会查 `ARXIV:{id}` 补全 corpus_id 与引用富化，**仅凭 corpus_id 创建的论文也会查 `CORPUSID:{id}` 反查 arxiv_id 并做同样的富化**（若该论文确实存在 arXiv 版本）；解析出 arxiv_id 后，arxiv 元数据/PDF 抓取会经依赖图自动衔接。若 S2 记录**没有** arXiv 版本，但提供了开放获取 PDF（`metadata.open_access_pdf_url`），`s2_pdf_service` 会下载该 PDF 并写入 `pdf_path`，后续解析服务照常衔接；闭源论文（`metadata.open_access_pdf_status` = `CLOSED`、无 url）不会有 `pdf_path`，`services` 中 `s2_pdf_service` 显示为 `blocked`。这类论文需由用户在站内论文详情页左侧 "PDF needed" 面板手动上传（站内接口 `POST /api/papers/:id/pdf`，External API 不提供上传）；上传后 `pdf_path` 出现、解析服务自动衔接
- `auto_template_qa=true` 时，仅执行缺少 done Result 的模板提问（只有 failed/cancelled 历史仍可重试），每次调用仍通过统一 QA ServiceRunner，并等待新 Result 终态后返回（单次回答受 `services.qa.time_limit` 限制，缺省 2h，超时记为 failed）
- 模板提问会在调用模型前把 `config.yml` 中当时最新的问题文本持久化到 QA Entry；首次调用失败也不会丢失问题，之后重跑仍会重新读取配置中的最新文本
- Internal UI 的 User Q&A `mine|all`、九种个人背景色（gray/brown/orange/yellow/green/blue/purple/pink/red）和 viewer-private 高亮/笔记引用计数不会改变 External API 的鉴权或查询范围。背景色仍是站内 preference，不新增 External API 字段；`qa.results[]` 可能附带内部稳定 `content_hash`，用于站内阅读标记，外部客户端无需依赖该字段
- 多回答默认选中最新 tab 完全属于 Internal UI：不改变 `/papers/full` 的 results 数组、排序保证或任何 External API 字段
- 新生成 Result 的 `execution_id` 现在精确指向本次 ServiceRunner execution；字段名称和 External API 响应形状不变，历史歧义关联不自动重写
- QA 的 `queued/awaiting_output/streaming/failed/cancelled`、局部 answer、Thinking 时间、Internal SSE 与 cancel API 均属于站内运行态；`/papers/full` 的 `qa.results[]` 只返回 `status=done` 的完成回答，并显式裁剪新增内部字段，因此现有 External API shape 不变
- 本机交互式 Codex QA 模型迁移到 `stream:true` app-server 及其英文流式状态提示仅影响 Internal UI/Service 执行方式；Bearer External API 的 endpoint、鉴权和完成回答 shape 均不改变
- 上下文提问（PDF 选段/截图提问、追问、system prompt 文件化、`#cite:` 引用）只属于 Internal API/UI，External API 不新增字段：`/papers/full` 的 QA 条目不返回 `instruction`/`inputs`/`parent_entry_id`。站内删除回答改为软删除，已软删除的回答不会出现在 `qa.results[]` 中；`qa.results[]` 改为按提问时间（`created_at`，再按 id）倒序。模板提问与站内一致，使用 `prompts/system/` 下的 system prompt 文件和新的 user 消息结构
- 该接口设有较长 timeout，等待所有抓取和提问完成后返回完整数据

**Response:**

```json
{
  "paper": {
    "id": 42,
    "arxiv_id": "2401.12345",
    "corpus_id": "123456789",
    "title": "Attention Is All You Need",
    "authors": ["Ashish Vaswani", "Noam Shazeer"],
    "abstract": "The dominant sequence transduction models...",
    "contents": {
      "user_input": null,
      "pdf_parsed": "We propose a new simple network architecture...",
      "doc2x_parsed": "# Attention Is All You Need\n\n..."   // doc2x 精确解析 Markdown（启用 doc2x 且解析完成后才有）
    },
    "pdf_path": "/data/pdfs/2401.12345.pdf",
    "metadata": {
      "citation_count": 178090,
      "reference_count": 137,
      "influential_citation_count": 19901,
      "tldr": "A new simple network architecture, the Transformer, based solely on attention...",
      "references": [{ "paper_id": "...", "title": "...", "year": 2015 }],
      "venue": "Neural Information Processing Systems",
      "year": 2017,
      "doi": "10.48550/arXiv.2401.12345",
      "fields_of_study": ["Computer Science"],
      "s2_url": "https://www.semanticscholar.org/paper/<paperId>"
    },
    "tags": ["transformer", "attention"],
    "created_at": "2026-03-18T10:00:00Z",
    "updated_at": "2026-03-18T12:30:00Z"
  },
  "qa": {
    "template": {
      "abstract": {
        "entry_id": 1,
        "results": [
          {
            "id": 1,
            "prompt": "请总结这篇论文的核心内容...",
            "answer": "本文提出了 Transformer 架构...",
            "model_name": "gpt-4o",
            "completed_at": "2026-03-18T11:00:00Z"
          }
        ]
      },
      "method": {
        "entry_id": 2,
        "results": [
          {
            "id": 2,
            "prompt": "请描述这篇论文的方法...",
            "answer": "采用自注意力机制...",
            "model_name": "gpt-4o",
            "completed_at": "2026-03-18T11:01:00Z"
          }
        ]
      },
      "experiment": {
        "entry_id": 3,
        "results": []
      }
    },
    "free": [
      {
        "entry_id": 10,
        "results": [
          {
            "id": 5,
            "prompt": "这篇和 BERT 有什么区别?",
            "answer": "主要区别在于...",
            "model_name": "gpt-4o",
            "completed_at": "2026-03-18T12:00:00Z"
          },
          {
            "id": 8,
            "prompt": "这篇和 BERT 有什么区别?",
            "answer": "从架构角度来看...",
            "model_name": "claude-sonnet",
            "completed_at": "2026-03-18T12:30:00Z"
          }
        ]
      }
    ]
  },
  "services": [
    {
      "id": 1,
      "service_name": "arxiv_service",
      "status": "done",
      "progress": 100,
      "created_at": "2026-03-18T10:00:00Z",
      "finished_at": "2026-03-18T10:00:05Z",
      "result": "OK",
      "error": null
    },
    {
      "id": 2,
      "service_name": "pdf_parse_service",
      "status": "done",
      "progress": 100,
      "created_at": "2026-03-18T10:00:06Z",
      "finished_at": "2026-03-18T10:00:10Z",
      "result": "OK",
      "error": null
    }
  ]
}
```

**`exclude` 参数示例：**

`GET /papers/full?arxiv_id=2401.12345&exclude=contents,services`

排除 `contents` 和 `services` 字段，减小响应体积。可排除的字段：`contents`, `qa`, `services`, `metadata`。

> **doc2x**：External API 端点本身不变。启用 doc2x 后，`contents` 可能多出 `doc2x_parsed`，`metadata` 可能多出 `doc2x_translation`（对照/仅译文 PDF 路径），`services` 中可能出现 `doc2x_parse` / `doc2x_translate` 执行记录；Q&A 文本按 `content_priority`（默认 `user_input > doc2x_parsed > pdf_parsed`）选择。doc2x 的触发与状态查询只走内部 API（`GET /api/papers/:id/doc2x`、`POST /api/papers/:id/doc2x/parse`、`POST /api/papers/:id/doc2x/translate`，会话登录），不对 Bearer Token 开放。

---

### 标签相关

**标签自动创建**：通过 External API 操作标签时，如果标签名不存在，系统会自动创建该标签并分配一个随机颜色。

**tags_json 同步**：所有标签操作完成后，系统会自动更新受影响论文的 `tags_json` 冗余字段以保持一致性。

#### PUT /papers/:id/tags

**覆盖**论文的所有标签（用于从 Zotero 全量同步）。

**Request Body:**

```json
{
  "tags": ["machine-learning", "transformer", "attention"]
}
```

**Response:**

```json
{
  "id": 42,
  "tags": ["machine-learning", "transformer", "attention"]
}
```

#### PATCH /papers/:id/tags

**增量更新**标签（添加/删除指定标签）。

**Request Body:**

```json
{
  "add": ["new-tag"],
  "remove": ["old-tag"]
}
```

**Response:**

```json
{
  "id": 42,
  "tags": ["machine-learning", "transformer", "new-tag"]
}
```

---

### 图床上传

#### POST /external-api/v1/images

给外部 agent 上传图片 / 视频用（不必把文件 base64 塞进 MCP 调用）。personal token；文件归 token 用户所有，校验、去重与站内 `POST /api/images` 相同（按文件头识别 PNG / JPEG / GIF / WebP / MP4 / WebM，图片上限 `image_host.max_size_mb`、视频上限 `image_host.max_video_size_mb`）。二选一：

- **原始文件体**：`Content-Type` 为 `image/*`、`video/*` 或 `application/octet-stream`，可带 `?filename=`、`?alt=`。
- **`?url=<http(s) URL>`**（无请求体）：服务端下载。只允许 http/https；主机解析到回环 / 私网 / 链路本地 / 未指定地址时 422 `URL_NOT_ALLOWED`；最多 5 次重定向（每跳重新检查）；超时 `image_host.download_timeout`（默认 60 s）；超过大小上限即中止。

```bash
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: image/png" \
  --data-binary @fig2.png "https://<站点>/external-api/v1/images?filename=fig2.png&alt=Figure%202"
```

响应（新文件 201，内容已存在 200）：

```json
{ "url": "/image/2026/10/16/a1b2c3.png", "markdown": "![Figure 2](/image/2026/10/16/a1b2c3.png)",
  "mime": "image/png", "kind": "image", "size": 48213, "width": 1520, "height": 540, "deduped": false }
```

错误：400 `INVALID_REQUEST`（无文件也无 url，或两者都给）/ `INVALID_MEDIA`（不识别、不允许或超限）；422 `URL_NOT_ALLOWED` / `DOWNLOAD_FAILED`。

---

### 批量操作

#### POST /papers/batch

批量创建/同步论文（Zotero 可能一次同步多篇）。

**Request Body:**

```json
{
  "papers": [
    {
      "arxiv_id": "2401.12345",
      "tags": ["tag1"]
    },
    {
      "corpus_id": "987654321",
      "link": "https://example.com/paper",
      "tags": ["tag2", "tag3"]
    },
    { "s2_paper_id": "204e3073870fae3d05bcbc2f6a8e263d9b72e776" }
  ]
}
```

**Response:**

```json
{
  "results": [
    { "id": 42, "arxiv_id": "2401.12345", "created": true },
    { "id": 18, "corpus_id": "987654321", "s2_paper_id": null, "created": false },
    { "id": 19, "s2_paper_id": "204e3073870fae3d05bcbc2f6a8e263d9b72e776", "created": true }
  ]
}
```

- 每条结果附带 `arxiv_id` / `corpus_id` / `s2_paper_id`；某条的 S2 标识无法识别时，该条返回 `{ "created": false, "error": { "code": "VALIDATION_ERROR", ... } }`，不影响其他条目

```
```

---

## Zotero 插件集成说明

### 同步流程

```
Zotero 插件侧边栏面板
    │
    ├── 1. 用户选中 Zotero 中的论文条目
    │      提取 arxiv_id（从 archiveID / extra / url 字段）
    │
    ├── 2. GET /external-api/v1/papers/full?arxiv_id={id}&auto_create=true
    │      查找/自动创建论文记录，获取 paper ID
    │
    ├── 3. PATCH /external-api/v1/papers/:id/tags { add: [...] }
    │      自动同步 Zotero item 标签（item.getTags()）
    │      增量添加模式：仅 add，不 remove，保留 Paperland 中手动添加的标签
    │      自动创建不存在的标签并分配随机颜色
    │      同步失败不阻塞面板显示
    │
    └── 4. 内嵌 Webview 展示论文详情页
           使用 XUL browser 元素加载 Paperland 前端（embed 模式）
```

**标签同步细节：**
- 同步时机：每次侧边栏面板渲染时（用户选中论文时）自动触发
- 同步范围：Zotero item 的所有标签（包括 type=0 手动标签和 type=1 自动标签）
- 幂等性：重复同步同一论文的同一标签是 no-op，无副作用
- 状态展示：面板状态行显示 "已同步 N 个标签"

### Zotero 中的文章 ID 映射

| Zotero 字段 | Paperland 字段 | 说明 |
|-------------|---------------|------|
| arXiv ID (从 URL/extra 提取) | arxiv_id | 主要匹配方式 |
| DOI | — | 可通过 DOI 反查 arxiv_id 或 corpus_id（**TBD**） |
| Semantic Scholar URL | s2_paper_id / corpus_id | 备用匹配方式（链接可直接作为 `s2_paper_id` 传入） |

---

## 错误响应格式

```json
{
  "error": {
    "code": "PAPER_NOT_FOUND",
    "message": "Paper with id 999 not found"
  }
}
```

| HTTP Status | 说明 |
|-------------|------|
| 401 | Token 缺失或无效 |
| 404 | 资源不存在 |
| 409 | 冲突（如重复创建） |
| 422 | 请求参数校验失败 |
| 500 | 服务器内部错误 |
