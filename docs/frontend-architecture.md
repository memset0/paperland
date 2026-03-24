# Paperland 前端功能架构

## 概述

Paperland 是一个论文管理网站。核心功能包括论文管理、数据抓取服务管理、以及基于大模型的论文 Q&A。

数据库使用 SQLite。全站配置统一在 `config.yml` 中管理。

---

## 全局导航结构

```
┌──────────────────────────────────────────────────────┐
│  Paperland                                            │
├──────────┬──────────┬──────────┬─────────────────────┤
│  论文管理 │  Q&A     │  服务管理 │  设置              │
└──────────┴──────────┴──────────┴─────────────────────┘
```

---

## 一、论文管理

### 1.1 论文列表页

- 展示所有已添加的论文
- 每条记录显示：标题、作者、来源（link）、日期
  - **来源列**：使用 `SourceTag` 组件（`components/SourceTag.vue`），根据论文的 `link` 字段显示可点击的来源标签
    - arXiv 论文：红色标签，格式 `arxiv:{id}`，点击跳转 arXiv abs 页面
    - 其他来源：灰色标签，显示域名（如 `mem.ac`），点击跳转原始链接
    - 无来源：显示 `-`
- **搜索**：按 title 和 abstract（arxiv 抓取的摘要字段）进行模糊匹配
- **排序**：支持按「添加时间」(`created_at`) 和「最近修改」(`updated_at`) 排序，通过搜索栏旁的下拉菜单切换。日期列标题和内容随排序模式动态变化。
- **修改时间追踪**：论文的 `updated_at` 字段在以下操作时自动更新：Free QA 提问、Template QA 触发/重新生成、QA 重新生成、高亮标注创建/编辑/删除。
- **分页**：支持分页浏览，每页条数可配置
- **多选**：支持勾选多篇论文进行批量操作（具体批量功能 TBD）
- 标签 / 分类 / 阅读状态：**TBD**

### 1.2 添加论文（三种方式）

#### 方式一：通过 arxiv_id 创建

- 用户输入 arxiv_id
- 系统查找是否已有匹配论文
  - 已存在 → 绑定（补充缺失 id）
  - 不存在 → 创建新记录
- 自动触发依赖 arxiv_id 的 fetch services

#### 方式二：通过 corpus_id 创建

- 用户输入 corpus_id
- 系统查找是否已有匹配论文
  - 已存在 → 绑定（补充缺失 id）
  - 不存在 → 创建新记录
- 通过 semantic scholar 获取对应的 arxiv_id（如有）并自动关联
- 自动触发依赖 corpus_id 和 arxiv_id（如已关联）的 fetch services

#### 方式三：手动输入创建

- 用户输入：
  - title（标题）
  - content（文章内容文本，作为 Q&A 的文本来源）
  - authors（作者）
  - link（来源链接，可选）
- 创建完成后询问用户是否要执行模板提问

```
添加论文流程:

用户选择添加方式
    │
    ├── arxiv_id ─────┐
    ├── corpus_id ────┤
    └── 手动输入 ──────┤
                      ▼
              ┌──────────────┐
              │ 查找已有论文  │
              └──────┬───────┘
                     │
              ┌──────┴──────┐
              ▼             ▼
          新建论文     绑定已有论文
              │         (补充 id)
              └──────┬──────┘
                     ▼
          ┌─────────────────────┐
          │ via arxiv/corpus:   │
          │   自动触发 fetch     │
          │                     │
          │ via 手动输入:        │
          │   询问是否跑模板提问  │
          └─────────────────────┘
```

### 1.3 论文编辑与删除

#### 编辑论文

论文详情页信息卡片右上角有编辑按钮（铅笔图标），点击进入编辑模式：

- **标题**：文本输入框（arXiv 论文禁用）
- **作者**：逗号分隔的文本输入框（arXiv 论文禁用）
- **来源链接**：文本输入框（所有论文均可编辑）
- **内容 (User Input)**：等宽字体 (`font-mono`) 的多行文本框，编辑 `contents.user_input` 字段

arXiv 导入的论文标题和作者字段显示为禁用状态（灰色背景），后端也会拒绝修改。

编辑完成后点击「保存」，仅发送有变更的字段（PATCH 语义），点击「取消」丢弃所有修改。

#### 删除论文

论文详情页信息卡片右上角有删除按钮（垃圾桶图标），点击弹出确认对话框：

- 显示论文标题和内部 ID
- 警告文案：说明所有 Q&A 条目、回答结果、服务执行记录、标签和高亮标注将被永久删除
- 需要用户手动输入论文的数字 ID 才能启用删除按钮（类似 GitHub 删除仓库的确认机制）
- 确认删除后，后端在事务中级联删除所有关联数据，前端跳转回论文列表页
- 删除后 ID 不复用（SQLite autoincrement 行为）

### 1.4 论文详情页（桌面端双栏布局）

```
┌─────────────────────────────────────────────────────────────────────┐
│  论文详情页                                                          │
├─────────────────────────────┬───────────────────────────────────────┤
│  [PDF 原文] [幻觉翻译]      │                                       │
│  ─────────────────────────  │   信息 & Q&A 区                       │
│                             │                                       │
│  ┌───────────────────────┐  │  标题 / 作者 / arxiv_id / corpus_id   │
│  │                       │  │                                       │
│  │   Multi-mode Viewer   │  │  ┌── 模板提问结果 ────────────────┐   │
│  │                       │  │  │  ...                           │   │
│  │  - PDF 原文 (iframe)  │  │  └────────────────────────────────┘   │
│  │  - 幻觉翻译 (hjfy.top)│  │                                       │
│  │                       │  │  自由 Q&A 历史记录...                 │
│  │  Tab 切换查看模式       │  │                                       │
│  │                       │  ├───────────────────────────────────────┤
│  │                       │  │       (悬浮提问框)                    │
│  └───────────────────────┘  │                                       │
└─────────────────────────────┴───────────────────────────────────────┘
```

#### 多模式查看器（PaperViewerPanel）

左侧面板支持多种查看模式，通过顶部 Tab 栏切换：

| 模式 | 条件 | 内容 |
|------|------|------|
| PDF 原文 | 论文有 `pdf_path` | 嵌入 PDF iframe（PdfViewer 组件） |
| 幻觉翻译 | 论文有 `arxiv_id` | 嵌入 `https://hjfy.top/arxiv/{arxiv_id}` iframe |

- 自动选中第一个可用模式
- 无可用模式时显示占位提示
- 模式系统可扩展：添加新模式只需在 modes 数组中增加条目

#### 窄屏布局

单栏布局（<900px）下，左侧查看器面板隐藏，仅显示论文信息和 Q&A 内容。

#### 浮动提问框定位

- **移动端**（< md）：`fixed bottom-0 left-0 right-0`，固定在视口底部，不随内容滚动
- **桌面端**（≥ md）：`sticky bottom-0`，固定在滚动容器底部，配合增强阴影（`shadow-2xl`）和更大间距

#### QA 快速导航（QAPanelNav）

右侧面板内容区右边缘的悬浮导航条，帮助用户在大量 QA 条目间快速定位。

- **未展开**：垂直排列的小灰点（每个点对应一个 QA 条目），当前可见条目的点高亮为 indigo 色，半透明（opacity 0.45），不遮挡底层文字选中
- **展开**：鼠标 hover 时向左展开为 ~260px 面板，显示每个 QA 条目的问题标题（单行截断）
- **点击**：平滑滚动到对应 QA panel，若处于折叠状态则自动展开并更新 localStorage
- **定位**：`position: sticky; float: right; width: 0`，浮在内容区右侧不占布局空间
- **移动端**：点击触发展开/收起，导航后自动收回
- **滚动监听**：`useScrollSpy` composable 使用 `IntersectionObserver` 监听 `[data-qa-entry]` 元素可见性，取最靠近顶部的可见元素作为 active

#### 模板提问状态展示

每个模板根据其 Service Execution 状态实时展示：

| 状态 | 图标 | UI 展示 | 可用操作 |
|------|------|---------|---------|
| idle | ⬚ | 空白，"未生成" | [单独生成] |
| pending | ⏳ | "已提交..." | 按钮禁用 |
| waiting | ⏳ | "等待依赖..." | 按钮禁用 |
| running | 🔄 | 进度条 + 百分比 | 按钮禁用 |
| done | ✅ | 展示最新 result 的 answer | [重新生成] |
| failed | ❌ | 展示错误信息 | [重试] |
| blocked | 🚫 | "缺少依赖，无法执行" | — |

- **实时更新**：前端通过短轮询（每 N 秒请求一次）获取最新状态，done 后立即展示回答
- **一键生成按钮**：仅当存在 idle 状态的模板时显示
- **双栏比例**：左右栏宽度支持拖拽调整（使用 Pointer Events API + `setPointerCapture` 确保快速拖动跟手），分隔条 2px 宽 + 12px 隐形热区
- **左侧面板折叠**：分隔条中间有 toggle 按钮（`PanelLeftClose`/`PanelLeftOpen` 图标），可一键折叠/展开左面板，带 300ms 过渡动画

---

## 二、Q&A 模块

### 2.1 两种提问类型

| | 模板提问 (Template) | 自由提问 (Free) |
|---|---|---|
| **索引方式** | template_name 为 key (e.g. "abstract") | 递增数字 id |
| **模板来源** | `config.yml` 中的 `qa` 列表 | 用户输入 |
| **模型选择** | config.yml 中的默认模型 | 用户通过复选框选择一个或多个（持久化到 localStorage，跨刷新保持） |
| **触发方式** | 手动（一键全部 / 单独生成） | 手动（用户提交问题） |
| **适用范围** | 所有论文通用的固定模板 | 针对具体论文的个性化问题 |

### 2.2 模板提问

#### 模板定义

- 定义在 `config.yml` 的 `qa` 列表中，每项包含 `name` 和 `prompt`
- `system_prompt` 字段定义论文内容与问题的拼接模板，使用 `{PAPER}` 和 `{PROMPT}` 占位符
- 列表顺序决定前端展示顺序

#### 一键生成按钮

- 仅当论文存在**未作答的模板**时显示
- 点击后遍历所有模板：
  - 已有结果 (results.length > 0) → 跳过
  - 已有 pending/running 的任务 → 跳过（防重复提交）
  - 无结果且无进行中任务 → 提交新任务
- 重复点击不会产生重复请求

#### 重新生成

- 手动点击 [重新生成] 按钮才会触发
- 从 `config.yml` 读取最新模板内容
- 使用 config.yml 中当前配置的默认模型
- 新结果追加到 results 数组末尾

### 2.3 自由提问

- 用户在输入框中输入问题并提交
- 通过复选框选择一个或多个模型（前端记忆上次选择）
- 每个选中的模型各自产生一个 result
- 支持重新生成（同一问题，不可更改问题文本）
- 新结果追加到 results 数组末尾

### 2.4 Q&A 入口

| 入口 | 说明 |
|------|------|
| 论文详情页内嵌 | 针对当前论文提问，paper_id 自动绑定，展示模板提问和自由提问 |
| 独立 Q&A 页面 (/qa) | 按时间倒序展示所有自由提问的 Feed 流（不含模板提问），每个 QA 为可折叠面板，显示关联论文标题及跳转链接，支持重新生成、删除、复制、Pin 等操作 |

### 2.5 提问的文本上下文来源

提问时需要将论文内容作为上下文发送给模型。从论文的 `contents` 字典中按 `config.yml` 的 `content_priority` 配置顺序取第一个非空值：

```yaml
# config.yml
content_priority:
  - user_input      # 用户手动输入 (最高优先级)
  - pdf_parsed      # PDF 解析 (最低优先级)
```

- 全部为空 → 报错提示用户
- PDF 通过 arxiv 抓取，使用 Python 脚本或 Node.js 库解析为纯文本（可配置）
- 用户在手动创建论文时输入的 content 存入 `contents.user_input`

---

## 二（附）、Markdown 渲染

### 渲染组件

`MarkdownContent.vue` 是全站统一的 Markdown 渲染组件，基于 `markdown-it` + `@traptitech/markdown-it-katex` + `KaTeX`。

### 数学公式支持

支持四种 LaTeX 定界符：

| 语法 | 类型 | 示例 |
|------|------|------|
| `$...$` | 行内公式 | `$E=mc^2$` |
| `$$...$$` | 行间公式 | `$$\int_0^1 f(x)dx$$` |
| `\(...\)` | 行内公式 | `\(\alpha + \beta\)` |
| `\[...\]` | 行间公式 | `\[\sum_{i=1}^n x_i\]` |

- 渲染引擎：KaTeX（同步渲染，轻量快速）
- 不支持的 LaTeX 命令降级为原始文本显示（`throwOnError: false`）
- 代码块内的数学定界符不会被渲染

### 样式

- 组件自带完整的 scoped CSS 样式（标题、列表、代码块、表格、引用等）
- 不依赖 `@tailwindcss/typography`，手动覆盖 Tailwind Preflight 的 reset（如 `list-style-type`）
- KaTeX 样式通过 `katex/dist/katex.min.css` 导入
- 行间公式居中显示，超宽公式支持水平滚动

### 文本高亮标注

`MarkdownContent.vue` 支持持久化的文本高亮标注功能。

#### 内容标识

- **pathname**：当前页面路径（不含 hostname），可通过 `highlightPathname` prop 覆盖（如 /qa 页面的 QA 内容使用原论文 `/papers/:id` 作为 pathname，而非 `/qa`）
- **content_hash**：markdown 内容去除所有空白字符后的 MD5 哈希（使用 `spark-md5`）
- 同一页面内所有 MarkdownContent 实例的 content_hash 不会重复

#### 偏移量

- 存储渲染后纯文本（`textContent`）中的 start/end offset
- 还原时通过 DOM text node 遍历定位并包裹 `<mark>` 元素
- KaTeX 公式作为原子单元处理：偏移量计算时不进入 KaTeX 内部节点，部分选中自动扩展为整个公式

#### 数据流

```
页面加载 → GET /api/highlights?pathname=... → 一次请求获取所有高亮
         → Pinia store 按 content_hash 分组 → 各 MarkdownContent 按 hash 取自己的高亮
         → DOM 后处理：遍历 text nodes，按 offset 包裹 <mark>

选中文本 → 浮动工具栏（4 色 + 可选笔记）→ POST /api/highlights → 更新 store → 重新渲染
点击/tap 高亮 → 弹出菜单（改色 / 编辑笔记 / 删除）→ PUT/DELETE /api/highlights/:id
悬停高亮（桌面端）→ Tooltip 显示笔记
```

#### 移动端适配

选择检测使用 `selectionchange` 事件（W3C 标准），在桌面和触摸设备上均可靠触发：

- **选择检测**：`document selectionchange` + 防抖（桌面 50ms / 移动 300ms），替代 `mouseup`
- **Tooltip**：桌面端 hover 显示；触摸设备上跳过独立 tooltip，tap 高亮直接弹出 click menu
- **弹窗关闭**：同时监听 `mousedown` + `touchstart`（passive），确保桌面和触屏都可点击空白区域关闭
- **触摸区域**：通过 `@media (pointer: coarse)` 将按钮最小触摸区域扩大到 44×44 CSS px
- **视口 clamp**：工具栏和菜单定位增加左右边界检测，防止在窄屏上超出容器

#### API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/highlights?pathname=...` | 按页面路径获取所有高亮 |
| POST | `/api/highlights` | 创建高亮 |
| PUT | `/api/highlights/:id` | 修改颜色/笔记 |
| DELETE | `/api/highlights/:id` | 删除高亮 |

#### 高亮颜色

黄（yellow）、绿（green）、蓝（blue）、粉（pink），不支持重叠高亮。

---

## 三、服务管理

### 3.1 服务分类

所有后台任务统一抽象为 Service，代码统一放在 `services/` 目录下，每个 service 配有单元测试。

| 类型 | 说明 | 触发方式 | 依赖管理 |
|------|------|---------|---------|
| Paper-bound Service | 绑定论文，声明 depends_on/produces | 自动（依赖图调度） | 参与 |
| Pure Service | 不绑定论文，输入输出在调用时确定 | 手动 | 不参与 |

### 3.2 Paper-bound Service 依赖模型

每个 paper-bound service 在代码中声明：

- **depends_on**: 执行前必须存在的论文键值
- **produces**: 执行后写入论文的键值

#### 论文字段分类

| 分类 | 字段 | 管理方式 |
|------|------|---------|
| 基础字段 | title, abstract, authors | 不纳入依赖管理，任何 fetch service 执行时顺手写入（如果为空） |
| 服务键值 | pdf_path, contents.pdf_parsed, citation_count, references, ... | 纳入依赖管理，由 produces 声明归属 |

#### 已知 Paper-bound Services

```typescript
semantic_scholar_service:
  depends_on: [corpus_id]
  produces:   [arxiv_id, citation_count, references, ...]

arxiv_service:
  depends_on: [arxiv_id]
  produces:   [pdf_path, arxiv_categories, ...]

pdf_parse_service:
  depends_on: [pdf_path]
  produces:   [contents.pdf_parsed]

```

#### 依赖图（前端可视化展示）

```
corpus_id ──→ semantic_scholar_service ──→ arxiv_id ──→ arxiv_service ──→ pdf_path ──→ pdf_parse_service ──→ contents.pdf_parsed
```

#### 自动调度逻辑

添加论文时，触发所有 paper-bound services，调度器根据依赖图自动决定执行顺序：

```
对于每个 paper-bound service:

  1. produces 的键值已全部存在?
     → 跳过，直接标记 done

  2. depends_on 的键值有缺失?
     → 找到能 produce 该键值的服务 X
       → X 已在 running/pending → 等待 X 完成
       → X 未触发 → 自动 trigger X (递归)
       → 无服务能 produce → 标记 blocked，跳过

  3. depends_on 全部就绪
     → 执行本服务

  4. 部分成功
     → 已拿到的键值写入论文
     → 标记 partial/failed
     → 用户可手动触发重新执行所有服务
```

### 3.3 Pure Service

| Service | 说明 |
|---------|------|
| qa_service | 调用大模型进行 Q&A |

- 注册为 `pure` 类型到 `service_runner`，使用 `executePureService()` 执行
- 受 `max_concurrency` 和 `rate_limit_interval` 约束，执行记录写入 `service_executions` 表
- 在服务管理页面可见（显示运行中/排队/最大并发数）
- 触发方式：用户手动提交 / External API 调用
- **前置条件**：调用方负责检查 content 不为空
- **启动清理**：服务器启动时将所有 pending/running 状态的执行记录（service_executions 和 qa_entries）重置为 failed

### 3.4 服务执行模型

**每个 service 独立的并发控制和速率限制：**

```
┌────────────────────────────────────────────────────────────┐
│                   Service Runner (调度器)                    │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  arxiv_service:           max_concurrency: 3                │
│    ┌─┐ ┌─┐ ┌─┐           rate_limit_interval: 3s           │
│    └─┘ └─┘ └─┘                                             │
│                                                             │
│  semantic_scholar_service: max_concurrency: 5               │
│    ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐  rate_limit_interval: 1s           │
│    └─┘ └─┘ └─┘ └─┘ └─┘                                    │
│                                                             │
│  pdf_parse_service:       max_concurrency: 2                │
│    ┌─┐ ┌─┐                (本地操作，无需限流)               │
│    └─┘ └─┘                                                  │
│                                                             │
│  qa_service:              max_concurrency: 2                │
│    ┌─┐ ┌─┐                (取决于模型 API)                  │
│    └─┘ └─┘                                                  │
│                                                             │
│  不同 service 之间完全并行，互不阻塞                          │
│  同一 service 内部受 max_concurrency 和 rate_limit 约束      │
│  同一 service 的 rate_limit 冷却不影响其他 service            │
└────────────────────────────────────────────────────────────┘
```

### 3.5 论文创建防重复机制

External API 可能并发创建同一篇论文，需防止数据库出现重复条目。

```
内存中维护: initializing_papers: Map<string, Promise>

key 格式: "arxiv:2401.12345" 或 "corpus:123456789"

请求 A: 创建 arxiv_id=2401.12345
  → check Map → 无 → 加入 Map (存入 Promise) → 创建论文 → 完成后移除

请求 B: 同时创建 arxiv_id=2401.12345
  → check Map → 已存在 → await Promise → 拿到已创建的论文

请求 C: 创建 corpus_id=999 → s2 解析出 arxiv_id=2401.12345
  → 写入 arxiv_id 前查 DB → 已存在 → 合并到已有条目
```

### 3.6 服务管理页面（全局 Dashboard）

- **服务列表**：展示所有已注册的 services，显示当前并发数 / 最大并发数、速率限制
- **依赖图可视化**：展示 paper-bound services 之间的键值依赖关系
- **并发配置**：为每个 service 配置最大并发数和速率限制
- **执行历史**：全局查看所有 service 的执行记录，**支持分页**，可按 service 名称和状态筛选

### 3.7 执行记录

每条执行记录包含：

| 字段 | 说明 |
|------|------|
| service_name | 服务名称 |
| paper_id | 关联论文 |
| status | pending → waiting → running → done / failed / blocked |
| progress | 执行进度 (0-100%) |
| created_at | 创建时间 |
| finished_at | 完成时间 |
| result / error | 执行结果或错误信息 |

### 3.8 服务执行状态流转

```
                  ┌───→ blocked  (依赖的键值无服务可产生)
                  │
pending ──→ waiting ──→ running ──→ done
  (已提交)  (等依赖)    (执行中)     │
                           │        ├── partial (部分键值写入成功)
                           │        │
                           └────────┴──→ failed
```

---

## 四、全局配置

所有配置统一在 `config.yml` 中管理。

### 4.1 配置结构

```yaml
# 数据库
database:
  type: sqlite
  path: ./data/paperland.db

# 认证
auth:
  users:
    - username: "admin"
      password: "your-password-here"
  # External API token (由前端签发，存储在数据库中)

# 服务配置
services:
  arxiv:
    max_concurrency: 3
    rate_limit_interval: 3     # 两次请求最小间隔 (秒)
  semantic_scholar:
    max_concurrency: 5
    rate_limit_interval: 1
  pdf_parse:
    max_concurrency: 2
    method: python             # python | nodejs
    python_script: ./scripts/pdf_parser.py
  qa:
    max_concurrency: 2

# 模型配置
models:
  default: "gpt-4o"
  available:
    - name: "gpt-4o"
      type: openai_api
      endpoint: "https://api.openai.com/v1"
      api_key_env: "OPENAI_API_KEY"
    - name: "claude-sonnet"
      type: claude_cli
    - name: "codex"
      type: codex_cli
```

### 4.2 Prompt 模板

- 定义在 `config.yml` 中的 `system_prompt` 和 `qa` 字段
- `system_prompt`：多行字符串模板，使用 `{PAPER}` 和 `{PROMPT}` 占位符定义论文与问题的拼接方式
- `qa`：有序数组，每项包含 `name`（模板名，作为 QA Entry 的 key）和 `prompt`（问题文本）
- 列表顺序决定前端展示顺序

### 4.3 前端设置页面

- 查看当前配置（只读展示或可编辑，**TBD**）
- 模型列表及默认模型选择
- 各 service 并发数调整
- **Token 管理**：签发 / 查看 / 撤销 External API Token

---

## 五、认证

### 5.1 网站登录 (HTTP Basic Auth)

- 访问任何页面需先通过 HTTP Basic Auth 登录
- 允许的用户名/密码配置在 `config.yml` 的 `auth.users` 中
- 个人使用项目，不需要复杂权限体系

### 5.2 External API Token

- 用户在「设置」页面签发 Token
- Token 无细粒度权限控制，持有即可访问所有 External API 端点
- 支持签发多个 Token（方便不同客户端使用）
- 支持查看已签发的 Token 列表和撤销

```
┌─────────────────────────────────────────────────────┐
│  设置页面 - Token 管理                                │
├─────────────────────────────────────────────────────┤
│                                                      │
│  [签发新 Token]                                      │
│                                                      │
│  已签发的 Token:                                     │
│  ┌────────────────────────────────────────────────┐  │
│  │ Token: sk-xxxx...xxxx   创建于 2026-03-18      │  │
│  │                                     [撤销]    │  │
│  ├────────────────────────────────────────────────┤  │
│  │ Token: sk-yyyy...yyyy   创建于 2026-03-15      │  │
│  │                                     [撤销]    │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 5.3 认证架构

```
浏览器 ──[HTTP Basic Auth]──→ Internal API + 前端页面
                                    │
                                    ├── 设置页面可签发 Token
                                    │
第三方  ──[Bearer Token]────→ External API (/external-api/v1/...)
(Zotero等)                    无细粒度权限，Token 有效即可访问全部端点
```

---

## 六、核心数据模型

### 6.1 Paper

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer (auto increment) | 内部主键 |
| arxiv_id | text (nullable, unique) | arXiv ID |
| corpus_id | text (nullable, unique) | Semantic Scholar corpus ID |
| title | text | 标题 |
| authors | text (JSON array) | 作者列表 |
| abstract | text (nullable) | 摘要 |
| contents | text (JSON, nullable) | 论文内容字典，详见下方 |
| pdf_path | text (nullable) | 本地 PDF 文件路径 |
| metadata | text (JSON, nullable) | 各服务抓取的其他元数据 |
| created_at | datetime | 创建时间 |

**`contents` 字典结构：**

| key | 来源 | 说明 |
|-----|------|------|
| `user_input` | 用户手动输入 | Q&A 上下文优先级最高 |
| `pdf_parsed` | PDF 解析 | Q&A 上下文优先级最低 |
| (可扩展) | 未来新来源 | 只需新增 key |

Q&A 取上下文时按 `config.yml` 中 `content_priority` 列表顺序，取第一个非空值。全部为空则报错。

### 6.2 Tag & PaperTag

**Tag:**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer (auto increment) | 主键 |
| name | text (unique) | 标签名称 |

**PaperTag (多对多关联表):**

| 字段 | 类型 | 说明 |
|------|------|------|
| paper_id | integer → Paper.id | 论文 |
| tag_id | integer → Tag.id | 标签 |

### 6.3 QA Entry

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer (auto increment) | 自由提问使用此递增 id 作为索引 |
| paper_id | integer → Paper.id | 关联论文 |
| type | text: "template" \| "free" | 提问类型 |
| template_name | text (nullable) | 模板名称，仅 template 类型有值，作为索引 key |
| status | text: "pending" \| "running" \| "done" \| "failed" | 执行状态 |
| error | text (nullable) | 错误信息 |
| created_at | datetime | 创建时间 |

### 6.4 QA Result

每个 QA Entry 关联一个 results 数组，默认展示最新的。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer (auto increment) | 主键 |
| qa_entry_id | integer → QAEntry.id | 关联的 QA Entry |
| prompt | text | 实际发送的问题文本 |
| answer | text | 模型的回答 |
| model_name | text | 使用的模型名称 |
| completed_at | datetime | 回答完成时间 |
| execution_id | integer (nullable) → ServiceExecution.id | 关联的服务执行记录 |

### 6.5 Service Execution

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer (auto increment) | 主键 |
| service_name | text | 服务名称 |
| paper_id | integer → Paper.id | 关联论文 |
| status | text | pending / running / done / failed |
| progress | integer | 0-100 |
| created_at | datetime | 创建时间 |
| finished_at | datetime (nullable) | 完成时间 |
| result | text (nullable) | 执行结果 |
| error | text (nullable) | 错误信息 |

### 6.6 ApiToken

| 字段 | 类型 | 说明 |
|------|------|------|
| id | integer (auto increment) | 主键 |
| token | text (unique) | Token 值 |
| created_at | datetime | 签发时间 |
| revoked_at | datetime (nullable) | 撤销时间，null 表示有效 |

### 6.7 数据关系

```
Paper (1) ──→ (N) QA Entry (1) ──→ (N) QA Result
  │
  ├──→ (N) PaperTag (N) ←── (1) Tag
  │
  └──→ (N) Service Execution
```

---

## 七、防重复提交机制

### 模板提问一键生成

```
点击 [一键生成所有模板回答]
         │
         ▼
   遍历所有模板 (从 config.yml qa 列表读取)
         │
         ├── 该模板已有 QA Entry 且 results.length > 0  → 跳过
         ├── 该模板已有 pending/running 的 Service Execution → 跳过
         └── 无结果且无进行中任务 → 创建 QA Entry + 提交 Service Execution
```

### 手动重新生成

- [重新生成] 按钮：强制提交新任务
- 模板提问：从 config 读取最新模板 prompt
- 自由提问：使用原始问题（不可更改）
- 新 QA Result 追加到 results 数组

---

## 八、分页

所有列表类数据统一支持分页。

### API 分页参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `page` | 1 | 当前页码 |
| `page_size` | 20 | 每页条数 |

### API 分页响应格式

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 156,
    "total_pages": 8
  }
}
```

### 需要分页的页面

| 页面 | 分页对象 |
|------|---------|
| 论文列表 | 论文条目 |
| 服务管理 - 执行历史 | Service Execution 记录 |
| 独立 Q&A 页面 | QA Entry 列表 |

---

## 九、全局 API 错误提示

前端通过 `api/client.ts` 发起的所有请求，如果返回非成功响应或网络错误，会自动在页面顶部弹出红色浮动 toast 通知。

### 机制

- `lib/error-bus.ts`：基于 `EventTarget` 的事件总线，API client 在 throw 错误前 dispatch 事件
- `components/GlobalAlert.vue`：挂载在 `App.vue` 根级，监听错误事件并展示 toast
- 该机制是补充性的全局兜底，不替代各页面已有的具体错误处理

### Toast 行为

| 特性 | 说明 |
|------|------|
| 自动消失 | 5 秒后自动移除 |
| 手动关闭 | 点击 X 按钮立即移除 |
| 最大数量 | 同时最多 5 条，超出时最旧的自动移除 |
| 动画 | 使用 Vue TransitionGroup 实现淡入淡出 |

---

## 待确认事项

### 已确认

- [x] ~~论文列表是否需要标签~~ → 支持标签（Zotero 同步）
- [x] ~~论文是否支持删除~~ → 暂不支持，未来如做则使用级联删除
- [x] ~~搜索方式~~ → 按 title 和 abstract 模糊匹配
- [x] ~~Service 限流~~ → rate_limit_interval 配置
- [x] ~~实时通知方式~~ → 短轮询
- [x] ~~双栏比例~~ → 可拖拽调整
- [x] ~~模板管理~~ → 通过 config.yml 中的 system_prompt 和 qa 字段管理
- [x] ~~批量操作~~ → 论文列表支持多选，具体批量功能 TBD
- [x] ~~数据库备份~~ → SQLite 每日备份，保留 30 天

---

## 十、嵌入模式（Embed Mode）

当 Paperland 页面在 Zotero 侧边栏等外部容器中通过 iframe/嵌入浏览器加载时，可通过 URL 查询参数激活嵌入模式，优化 UI 以适应狭窄的侧边栏环境。

### 10.1 URL 参数

| 参数 | 格式 | 说明 |
|------|------|------|
| `embed` | `embed=1` | 激活嵌入模式，隐藏导航 chrome、缩小内容边距、显示刷新按钮 |
| `bg` | `bg=f2f2f2`（6 位 hex，不带 `#`） | 自定义页面背景色，可独立于 embed 参数使用 |

示例 URL：`/papers/42?embed=1&bg=f2f2f2`

### 10.2 嵌入模式行为

| 变化 | 说明 |
|------|------|
| 隐藏桌面侧边栏 | 52px 图标导航栏不渲染 |
| 隐藏移动端导航栏 | 顶部 navbar 和汉堡菜单不渲染 |
| 隐藏论文标题 header | PaperDetail 页面的返回按钮 + 标题栏不渲染 |
| 缩小内容边距 | 单栏布局 padding 从 `p-5` 缩小到 `p-2`，去掉 `max-w-3xl` 限制 |
| 刷新按钮 | 页面顶部显示紧凑的刷新按钮工具栏（h-8），点击执行 `window.location.reload()` |
| 强制单栏布局 | 无论视口宽度如何，PaperDetail 页面始终使用单栏布局，不启用双栏分屏视图 |
| 自定义背景色 | `bg` 参数应用到 `document.documentElement` 和根 div |

### 10.3 实现

- **Composable**：`composables/useEmbedMode.ts` 在模块加载时从 `window.location.search` 读取并缓存参数，提供 `isEmbed`（boolean）和 `bgColor`（string | null）响应式状态
- **App.vue**：条件渲染侧边栏和移动端导航，应用背景色
- **PaperDetail.vue**：条件渲染标题 header / 刷新按钮工具栏，动态切换内容区 padding

---

### 待确认

- [ ] 论文列表是否需要分类 / 阅读状态功能
- [ ] 设置页面是只读展示还是支持在线编辑 config.yml
- [ ] 论文详情页是否需要展示引用关系
- [ ] 批量操作的具体功能（批量跑模板提问、批量删除等）
- [ ] 移动端适配策略（双栏 → 单栏切换？）
- [ ] Token 是否需要过期时间
