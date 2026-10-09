## Why

现在每种用户数据各自用一套可见性规则：高亮和参考链接只有本人能看；Free Q&A 的 all 范围对所有登录用户开放，没有退出选项；笔记只靠单篇 `is_public` 公开发布来共享，管理员还要额外勾选 `include_private`。用户没有办法决定自己的数据是否给别人看，各页面的 mine/all 切换和管理员权限也不一致。需要把数据统一分成三类：始终共享、纯私有、用户可选共享，并让所有相关列表都用同一套 mine/all 语义。

## What Changes

- **数据分类**（写入 spec）：
  - 始终全站共享：论文（无论谁添加都进入全站列表，避免重复抓取）、Preset Q&A、会议、翻译缓存。
  - 纯私有：标签、图床图片列表、API token、Q&A 阅读偏好。
  - 用户可选共享：高亮、笔记、Free Q&A（以后的划线/截图提问也存为 Free Q&A，共用同一开关）、参考链接。
- **共享开关**：每个用户对每种可选共享的数据类型有一个全局开关，打开后，自己该类型的全部数据（已有的和新建的）都出现在其他人的 all 列表里。默认值是“共享”，由 `config.yml` 的 `sharing.default_shared` 配置，默认 `true`。用户没有改过开关时使用这个默认值，所以现有数据迁移后自然处于共享状态。
- 新增 `GET/PUT /api/auth/me/sharing` 接口，账户对话框（AccountDialog）新增 “Sharing” 区域，放四个开关。
- **统一的 mine/all 语义**：
  - `mine`：只返回本人的数据。
  - `all`：普通用户看到的是本人数据加上开启了该类型共享的其他用户的数据；管理员看到全部用户的数据，不论对方是否共享。
  - 不属于当前用户的条目都标明所属用户名；管理员看到的未共享条目额外标 “Private”。
- **页面切换**：`/notes`、`/qa` feed、论文详情的 User Q&A 卡片、参考链接区、高亮显示都提供 Mine / All 切换。别人的高亮用区别样式显示且只读。
- **BREAKING（行为）**：Free Q&A 的 all 范围改为尊重作者的共享开关；`GET /api/notes` 的 `include_private` 参数废弃，管理员的 all 直接包含全部笔记；`GET /api/papers/:id/public-notes` 的返回范围从“仅公开发布”扩展为“当前访问者可见的他人笔记”。由于默认共享，现有的私有笔记、高亮和参考链接会对其他登录用户可见，除非作者关闭对应开关。
- **笔记公开发布是特例**：`is_public` 继续作为单篇笔记的 “Published” 状态并提供匿名可访问的链接，与共享开关无关。已公开发布的笔记不管作者的笔记开关怎么设，都会出现在 all 列表中。
- 读取别人的数据只读，写操作仍然只允许所有者或管理员，后端继续校验。
- 匿名用户的行为不变：只能看到论文、Preset Q&A 和公开发布的笔记。
- 同步更新 `docs/frontend-architecture.md`、`docs/external-api.md`、`docs/tech-stack.md`。

## Capabilities

### New Capabilities
- `data-sharing-preferences`: 数据分类（共享 / 私有 / 可选），每用户每类型的共享开关及其 API、配置默认值和账户设置 UI，统一的 mine/all 可见性规则和角色差异。

### Modified Capabilities
- `data-ownership`: 所有者范围读取改为由数据分类和共享开关决定；Free Q&A 的 all 范围尊重共享开关。
- `markdown-highlight`: 高亮从严格私有改为可选共享，支持 `scope=mine|all`，别人的高亮只读且区别显示。
- `paper-reference-links`: 参考链接从严格私有改为可选共享，支持 `scope=mine|all`，详情区可切换并标明作者。
- `notes-page`: `/api/notes` 的 all 范围改为“共享或已发布或本人”，管理员包含全部，移除 `include_private`。
- `public-notes`: 每篇论文的他人笔记列表按可见性规则返回（共享 + 已发布），单篇读取遵循同一规则；公开发布保留为匿名链接特例。
- `qa-feed-page`: `/qa` feed 的 all 范围按共享开关过滤，管理员看全部；所有登录用户都显示切换按钮。
- `qa-display-split`: 论文详情 User Q&A 的 all 范围按共享开关过滤。

## Impact

- 后端：新表 `user_sharing_settings`（Drizzle migration）；新的可见性辅助模块；`api/qa.ts`、`api/notes.ts`、`api/highlights.ts`、`api/reference_links.ts`、`api/auth.ts` 的读取过滤；`config.ts` 新增 `sharing` 配置块；Result SSE 的可见性校验沿用新规则。
- 前端/shared：共享类型定义；AccountDialog 的 Sharing 区域；NotesPage、QAPage、PaperDetail（User Q&A、参考链接、高亮、他人笔记）的 scope 切换、所属用户标签和 Private 标记；highlights store 支持 scope 和只读的他人高亮。
- 依赖：与 `add-qa-all-users-scope`（已完成、未归档）修改的是同一组 QA 需求，本变更应在它之后归档。`add-selection-ask` 如果选方案 A（存为 `qa_entries`），会自动沿用 Free Q&A 的共享开关。
- 文档：`docs/frontend-architecture.md`、`docs/external-api.md`、`docs/tech-stack.md`。
- 测试：顺带修复已有的 `images.test.ts` 失败（同一 (用户, 论文) 插入两条笔记违反唯一索引），改为两篇论文各一条笔记，测试意图不变。
