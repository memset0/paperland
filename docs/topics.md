# Topics 仓库与接口约定

Topic 是长期维护的研究成果。用户在本机使用自己的 agent，通过 MCP 查资料并用 Git 同步。每个 Topic 有主报告、可选调研页面和一份全局编号资料表。页面通过 frontmatter 指定资料表子集；旧分层清单保留格式兼容及历史，但不再作为新页面的组织结构。

## 仓库 schema v1

```text
topic.json
reports.yml                     # 页面顺序和嵌套分组
references.json                 # 唯一全局资料表
AGENTS.md                       # agent 操作约定；可作为指南读取
README.md                       # 仓库说明，不是默认报告
pages/
  report.md                     # 默认打开的报告
  research-questions/
    index.md
    rq0-benchmarks.md
    rq6-robo-use-rsi.md
  background/original-report.md
  discussions.md
workspace/                      # 可选 agent 工作文件，不展示/不执行
```

`topic.json` 使用 `{ "schema_version": 1, "title": "Attention", "description": "A maintained survey" }`。所有研究页面必须在 `pages/` 下，可嵌套目录；文件/目录段使用字母数字（含 Unicode）、点、下划线或连字符，不以点开头。根目录 `AGENTS.md` 是操作指南例外，README 不进入页面列表。其他安全普通文件可作为 Git 工作区，允许小型二进制文件和辅助脚本；服务器不执行它们，网站不当作页面。它们与整个 Topic 一起共享，不能充当私有凭证区。

每页可有 YAML frontmatter：

```markdown
---
title: "RQ6: Robo-use RSI"
fonticon: RefreshCw
references: [3, 8, 12]
---
# A coherent research report

See [3](#ref:3), [another question](rq7-future-prediction.md), or
[PDF page 5](paperland://paper/123?pdf=5).
```

`title` 为 1–200 字符纯文本，覆盖侧栏标签；`fonticon` 用站内 Lucide 图标名，支持 PascalCase 或 kebab-case，未知名字安全退回 FileText。可用名称由 MCP `repository_contract.fonticons` 给出。目录树由 reports.yml 指定顺序/分组，当前文件的祖先会展开；旧提交回退到文件夹树。文件夹 `index.md` 使用文件夹地址；如 `pages/research-questions/index.md` 对应 `/topics/3/research-questions`，`pages/discussions.md` 对应 `/topics/3/discussions`。默认 `/topics/3` 对应 `pages/report.md`。旧 `?file=...`、旧主页和唯一同名文件的迁移链接仍兼容；历史版本用 `?version=<commit>`。

## 全局资料表

`references.json`：

```json
{
  "format_version": 1,
  "references": [
    {"id":"local-paper","reference_number":1,"title":"A library paper","paper_id":123,"comment":"Baseline"},
    {"id":"external-paper","reference_number":2,"title":"An external paper","s2_id":"CorpusId:13756489","comment":"To read"},
    {"id":"project-page","reference_number":3,"title":"Project page","url":"https://example.org/project","citation":{"title":"Project page"},"comment":"Implementation notes"}
  ]
}
```

条目必须有稳定 `id`、正整数 `reference_number` 和 `title`，且只能有一个 `paper_id`、`s2_id` 或 HTTP(S) `url`；URL 必须有 `citation`。可选字段为 `comment`、`authors`、`year`、`verification` 与 citation 的 `author` 数组、`year`、`month`、`howpublished`、`note`。schema v1 不使用目录归属字段。ID 与编号不得重复；同 ID 不可换资料来源，已分配编号不可改名/复用，新条目从 MCP `next_reference_number` 顺序追加。推荐按编号排序，顺序依据首次进入 Topic，而非发表年份、Git 声明时间或后续数组重排。

资料不归属某一报告：任意多篇报告可在 `references` frontmatter 中复用相同编号，不复制资料元数据。引用编号必须是该版本全局表的子集。不同方法版本可视为不同工作，例如 HexaShell Preview/TaskTools 与 Universal/v3 使用独立条目和固定版本来源，不能只按 base arXiv ID 自动合并。

push 不联系 S2、不自动入库。显式一键导入 S2 条目时沿用站内去重/个人 library 流程；普通项目 URL 仅作为链接，不自动抓取或导入；明确 arXiv 论文 URL 可通过显式按钮按规范 ID 入库并保留固定版本来源。媒体继续用现有存储。历史 legacy format_version:1 的 `report.md` / `papers.json` 仍可读，其目录数据保存在历史与迁移工作区存档中；schema v1 当前生成标签只用平面全局表的根关联。


阅读页的数字引用可 hover/聚焦或点击/触摸打开论文卡片，显示该版本资料元数据、来源和站内/导入操作；不是只有 title tooltip。S2 与可识别 arXiv 论文 URL 可显式一键加入操作者自己的 library，已存在时去重，普通项目 URL 保持来源链接。固定版本来源仍保留，站内 arXiv 记录按已有规范 ID（不含 vN）处理；原引用身份/编号不合并。当前页引用默认折叠，All references 独立右侧抽屉；展开前不更新引用列表阅读基准。

## 持久化与配置

仓库、操作暂存和恢复日志放在 `topics.repos_dir` 下，默认 `./data/topics`；可配置绝对路径。备份/恢复需同时保留数据库与该目录。报告/全部页面、资料表、当前索引统一切换；恢复日志记录原始推送者，用于完成 Git 已推进而数据库尚未索引的操作。

```yaml
topics:
  repos_dir: ./data/topics
  git_path: git
  max_file_bytes: 2097152
  max_push_bytes: 16777216
  max_commits_per_push: 100
  operation_timeout_ms: 60000
pdf_pages:
  pdfinfo_path: pdfinfo
  pdftotext_path: pdftotext
  pdftoppm_path: pdftoppm
  max_dimension: 1600
  max_image_bytes: 8388608
  timeout_ms: 20000
  max_concurrency: 2
```

PDF 按页工具依赖本机 Poppler（Ubuntu 的 `poppler-utils`），只在显式要求图片时生成指定物理页的截图。所有页码按 PDF 页序从 1 开始。

## 权限和计数

所有者管理逐 Topic default_access（none=Private、viewer/editor=Public）及个人 viewer/editor grant；个人与默认按 none < viewer < editor 取高，移除 grant 回到默认，不能把某个用户降到默认以下。Public 只授予 active 登录用户，不对匿名开放，也不继承旧全局 Research 开关。Share 管权限；连接外部应用统一在 Plugins 页（Topic 页不再有 Connect）。每个成员用自己的 Plugins 服务密钥访问 MCP/Git，服务不限定 Topic，按属主在每个 Topic 的角色执行（只读服务不能推送）。凭证换新和撤销不重置调用次数。

Topic 专属凭证已取消：升级时仍有效的 Topic token 被转换为名为 "Topic token <id>" 的 Plugins 服务（原密钥继续可用于 MCP 与 Git，作用范围变为属主的整个账号）。数据库中的 verifier 不能作为凭证使用。管理员 Settings → All credentials 可查看与撤销服务（不显示密钥值）。

每次已认证的已知 MCP 工具调用尝试计一次，包含失败；JSON-RPC batch 逐工具计数。初始化、列表、通知和认证失败不计为工具调用。用户总计覆盖 Q&A Codex、旧 Research、外部 agent 和 Topics；有 Topic 上下文时同时记对应用户/Topic 子计数，无记录为 0。不追补历史数据，不保存逐次请求/流量明细。

`GET /api/usage/mcp`（需网站登录）返回当前用户的 `{data:{user_id,counts,total}}`，`counts` 按已知工具名补齐为零；不会返回其他用户的总量。Private Topic 移除个人授权会撤销旧凭证，再次分享不复活；Public 移除个人授权后凭证按剩余默认权限执行。任何时候丧失有效访问权，MCP/Git 即拒绝。

加 `?topic_id=...` 时只返回本人在该可访问 Topic 的子计数；返回中另带 `topic_id`。工具名下线后已有计数仍保留。

真实推送者另保留不可变的 `uploader_user_id` 与当时的显示名，避免账号删除使未完成发布无法恢复或让历史推送失去归属。

## Topic 标签筛选

论文列表/详情响应中的 `topic_tags` 是 `[{topic_id,node_id:"root",name}]`，只包含当前 viewer 可访问 Topic 的根标签，与 `tags` 手工标签分开。`GET /api/papers?scope=all&topic_id=1&topic_node_id=methods` 搜索当前目录及其后代；省略 node 表示根。它与 scope、search、`tag_ids` 组合；手工标签筛选也验证当前用户归属。目录改名/移动不改变 node ID，移除 Topic 条目不删除手工标签或其他 Topic 的关联。

## 网站 API

以下端点需网站会话，返回 `{data:...}`。成员身份在每次操作时检查，管理员身份本身不额外授予 Topic 访问权。

Topic API 响应使用 `Cache-Control: private, no-store`；MCP 响应也不允许 HTTP 缓存。localStorage 仅保存按账号隔离的已展示内容基准，不作为服务端内容或权限的权威来源。

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/api/topics?scope=mine\|all` | 自己或全部可访问的 Topic |
| POST | `/api/topics` | `{title,description?,seed_result_id?,default_access?}`；创建并初始化 Git，不运行模型 |
| GET | `/api/topics/seed-preview?result_id=...` | 可见 Q&A 回答的快照预览 |
| GET | `/api/topics/:id?commit=...` | 当前或历史的一致报告/清单，含权限/default_access、`documents`、`reference_numbers`/`next_reference_number`、兼容目录、`paper_bindings`、本人 `paper_in_library` 与调用子计数 |
| PATCH | `/api/topics/:id` | owner/editor 用 `{title,base_commit}` 改名；只提交 topic.json，stale 返回 409 |
| GET | `/api/topics/:id/history?offset=0&limit=50` | `{versions,total,next_offset}`；Git 作者与真实推送者分列 |
| PUT | `/api/topics/:id/sharing` | owner 用 `{default_access:"none"\|"viewer"\|"editor"}` 修改一般权限 |
| GET / PUT | `/api/topics/:id/members` | 读取个人 role 与 effective_role；owner 用 `{username,role:"viewer"\|"editor"\|null}` 分享、调整或撤销 |
| GET / POST | `/api/topics/:id/tokens` | 本人的凭证元数据；签发新凭证，只在创建响应返回完整 token |
| POST | `/api/topics/:id/tokens/:token_id/rotate` | 替换本人凭证，返回一次新值 |
| DELETE | `/api/topics/:id/tokens/:token_id` | 撤销本人凭证 |
| POST | `/api/topics/:id/import` | `{entry_id,commit?}`；显式导入该版本条目到操作者自己的 library |

`get_topic` 可选 `document: "pages/rq6.md"` 仅读该文档及其编号引用，或 `metadata_only: true` 省略所有页面正文，避免长 Wiki 重复返回全文；不传参数保留完整兼容结构。文档路径仍受 Topic/历史权限限制，不能读取任意仓库路径。

## Git 使用与恢复

在 Plugins 页为自己的 agent 创建服务（或复用已有服务），然后 clone `https://paperland.dev.mem.ac/topic-git/<id>.git`。HTTPS 认证提示的密码填写服务密钥（用户名任意）；也可由自己的 credential helper 提供。URL 不包含凭证。服务接受 Basic 的密码或 Bearer header；agent token 不用于 Git。push 需要该 Topic 的 editor 权限、服务的 write 权限且 Topic 未归档；推送记录所用服务，版本历史显示 "via <服务名>"。

```sh
git clone https://paperland.dev.mem.ac/topic-git/1.git
cd 1
git pull --ff-only
# Edit pages/, references.json and optional workspace files; preserve IDs/numbers.
git add -- pages/report.md references.json
git commit -m "Update findings"
git push origin main
```

只接受 main 的 fast-forward 更新，不接受额外 refs、删除 main、force rewrite、非法文件或无效中间提交。多人冲突时先 fetch/pull 并处理合并，不能覆盖已提交内容。一次成功 push 就发布完整版本，无草稿/发布按钮。Git author/committer 是自行声明的信息，服务端另记认证用户、credential ID、服务器时间及 old/new commit。

push 先进入临时 bare 仓库；所有新版本校验完成后，先写恢复日志，再推进正式 Git ref，最后在事务中发布快照/索引/审计。成功响应等待索引完成。若 Git 已推进但索引中断，网站仍展示上个完整快照，服务启动或下次 Git 访问会幂等恢复；恢复未完成时不会继续发布其他更新。不要手动删恢复日志或回退 main。

## 归档

owner 可归档 / 取消归档 Topic（网页 `PUT /api/topics/:id/archive {archived}`，MCP `set_topic_archived`，需有 write 的 Plugins 服务）。`topics.archived_at`（迁移 0050，可空）记录归档时间，列表与详情、`list_topics` / `get_topic` 均返回 `archived_at`。归档的 Topic 照常列出（API 顺序不变、不更新 `updated_at`；网页 Topics 列表把它们放在下方单独的折叠分区 "Archived (N)"，不与未归档的混排）并可阅读、查看历史、clone/pull、把引用论文导入自己的库；内容冻结：网页改名返回 403，Git `git-receive-pack`（advertisement 与 push）返回 403 和“已归档”提示，系统迁移脚本不受此限制。共享和成员仍可管理。

## 网页改名与旧结果迁移

owner/editor 在最新版详情标题旁使用 Edit name，可缩短专题名称。Save name 写入一个新 Git 版本，只改变 `topic.json`，报告、所有 pages 文档、资料表、AGENTS/README 和辅助工作文件 的 blob 不变，根标签显示名同步更新。编辑期间暂停自动刷新；冲突时保留输入，使用 Refresh latest 取得新基准后再保存。viewer/历史视图没有改名入口。

一次性迁移命令必须从项目根目录执行：

```sh
bun run scripts/migrate-research-to-topics.ts --dry-run
# Check active jobs, quiesce paperland.service, then apply once.
bun run scripts/migrate-research-to-topics.ts --apply --backup-dir /path/to/private/safety-copy
bun run scripts/migrate-research-to-topics.ts --verify
```

默认是只读 dry run；可用 `--config /path/config.yml` 指定配置。apply 在任何数据修改前通过 SQLite `VACUUM INTO` 生成包含 WAL 已提交数据的一致性快照并检查完整性，然后使用 maintenance 初始化，仅更新 schema，不播种账号/凭证、不启动 provider。一个旧会话对应一个 Topic，每个有效结果/标题编辑对应一个 Git 版本；报告、目录说明、条目顺序、评论、URL 引用和 change note 保留。S2 显示信息只取已有本地数据/缓存，不访问网络、不增加 papers 或个人 library 记录。

唯一 legacy session/step 映射和持久化转换计划使失败后可重跑；pending Topic 在网页、Git、MCP、论文标签中均不可见，完整导入后才开放。完成后清空临时计划，重跑不会覆盖用户改名或后续 Git 更新；全已完成时走只读验证，不再创建全库备份。原 research_sessions/research_steps 不变，详情的 Original research 链接保留原始时间线、指令和 seed 供核对。

所有者保持原账号。原先站内共享的会话转为迁移时 active 用户的 viewer 成员，私有会话只保留 owner；不把管理员旧有的全局查看特权转换为私有 Topic 的成员资格。迁移提交标为 Paperland migration 系统操作，不假称所有者亲自 push。原模型、步骤和时间记录在提交来源中。

## MCP 工具

MCP 只接受 Plugins 服务密钥（Bearer 或 `/mcp/s/<密钥>`）与站内 agent token。Topic 工具按调用者在该 Topic 的角色和服务权限执行；需要 Topic 的工具都必须传 `topic_id`。原站内自动 agent 的 mutation allowlist 不扩大。

原站内 Q&A / 旧 Research 的工具 allowlist 保持原状；新增 Topic/PDF 工具供外部 MCP 客户端使用。有 write 的服务可用 `upload_image` 的 data/url 上传到既有图床，也可用同一密钥通过 External API 上传本机大文件。

新增 `list_topics`、`get_topic`、`get_topic_history`、`create_topic`、`get_topic_members`、`set_topic_member`、`set_topic_sharing`、`set_topic_archived`、`import_topic_paper`。写入与管理操作需有 write 的 Plugins 服务；凭证管理不通过 MCP（原 `*_topic_token` 工具已移除），只在 Plugins 页进行。各工具的 JSON Schema 由 `tools/list` 给出。

`read_pdf_page({paper_id,page,image?,region?,offset?,max_chars?})` 使用物理 PDF 页码，返回 `paper_id`、`page`、`page_count`、文本分段与完整 Markdown 定位引用；`image:true` 时另返回真正的 MCP PNG image block。`region` 是 `{x,y,width,height}` 归一化坐标，仅改变引用定位，截图仍是整页。默认不生成图片，不下载远程 PDF，不批量转换全文。


## 现有仓库布局迁移

从项目根目录运行 `bun run scripts/migrate-topic-pages.ts --dry-run`。停下活动工作并暂停服务后，以 `--apply --backup-dir <private-path>` 备份并迁移，最后 `--verify`。该命令把 v1 当前主报告原 blob 移到 pages/report.md、用原编号生成 references.json、将旧 papers.json 存入 workspace/legacy，并用新 Git 提交记录系统迁移；不改历史/成员权限/编号，不运行 provider。重复 apply 跳过已完成仓库。旧备份/原 Research 导入后的 v1 仓库可用同一命令升级；已升级仓库拒绝降级。

## Schema 版本、显式目录与升级

截至当前的完整规范统一称 **schema v1**，`topic.json` 写 `schema_version: 1`，不同时声明旧 `format_version`。MCP `get_topic_schema(schema_version?)` 返回当前或指定受支持版本的完整范例、字段、资源限制和迁移步骤。当前支持 schema 1；保留 legacy `format_version:1/2` 两种历史读取路径，不把旧 layout 2 称为 schema v2。未知未来版本会明确拒绝，不猜测解析。

根目录 **reports.yml** 是页面总目录，控制顺序与分组。默认固定 `pages/report.md`。示例：

```yaml
schema_version: 1
default_page: pages/report.md
reports:
  - path: pages/report.md
  - path: pages/research-questions/index.md
    children:
      - path: pages/research-questions/rq6-robo-use-rsi.md
  - title: Background
    fonticon: Archive
    children:
      - path: pages/background/original-report.md
```

每个实际 `pages/**/*.md` 必须恰好出现一次。页面项用 `path` 和可选 `children`，标题/图标只取文档 frontmatter；纯分组用 `title`、可选 `fonticon` 和非空 `children`。上例需要与真实文件集合一致，新增/移动页面必须同步清单；遗漏、重复、未知/越界路径、错误默认页、超过 8 层或 64 项都会拒绝整个 push。`AGENTS.md`、README、辅助文件不列在 reports 中。带概览页的分组只占一行，箭头展开与点击打开概览互不干扰；历史无清单时由文件夹生成兼容树。

`get_topic.repository_schema` 含所选提交的 `schema_version`、`encoding`、`current_schema_version`、`supported_schema_versions`、`supported_legacy_formats` 和 `migration_required`。metadata_only 同样返回状态、导航与完整 contract；单页读取仍受同一 ACL。MCP initialize 明确引导 agent 在编辑前读取 `get_topic_schema` 并检查是否需升级。这个只读工具的成功/失败调用沿用用户及可选 Topic 计数。

旧 layout 2 升级：pull 最新 main，将 topic.json 的 format_version 改为 schema_version:1；添加完整 reports.yml；其余页面、references.json、workspace 和自定义 AGENTS.md 保留；一起提交/push 后再用 get_topic 校验。旧 layout 1 先将 report.md 原样移动到 pages/report.md，用权威 reference_numbers 将 papers.json 的条目转成 references.json（去 directory_ids），将旧表存档到 workspace/legacy/，再完成上述步骤。若旧仓库已有 reports.yml 工作文件，先移入 workspace/，迁移会报冲突而不会覆盖。不改写历史、不复用编号、不伪造用户推送；已升级仓库拒绝降级。

维护命令从根目录运行（apply 前停止后端，结束后再启动，避免另一个进程并发推送；可用 `--topics 1,2` 选择专题）：`bun run scripts/migrate-topic-schema.ts --dry-run`、`--apply --backup-dir <dir>`、`--verify`。apply 先一致备份数据库，再用 journal/CAS 生成系统审计的新提交，支持中断恢复和重复运行跳过。部署兼容读者后再升级仓库；回滚须使用支持 schema v1 的代码与完整备份，不能把 Git 强推回旧格式。
