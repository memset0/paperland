# Paperland External API

## 概述

External API 是独立于前端 Internal API 的第三方接口，主要用于 Zotero 插件等外部服务与 Paperland 进行数据同步。

---

## 认证

### 获取 Token

**管理员**在 Paperland 前端「设置」页面签发 Auth Token（Token 管理为管理员专属），复制后配置到第三方服务中。

### 使用 Token

所有 External API 请求需在 Header 中携带 Token：

```
Authorization: Bearer <token>
```

未携带或 Token 无效 / 已撤销时返回 `401 Unauthorized`。

### Token 的用户归属

每个 Token 归属一个用户（签发它的管理员，或指定用户）。以该 Token 调用 External API 时，请求**按其归属用户**操作：因此通过 Token 创建 / 同步的**标签**等按用户私有的数据，归该用户所有，与其他用户的数据相互隔离。升级到用户系统前已存在的 Token 一律迁移归属到初始 `admin` 用户，**Zotero 等既有集成无需改动即可继续工作**。

---

## API 端点

Base URL: `/external-api/v1`

---

### 论文相关

#### POST /papers

创建论文条目。如果论文已存在（通过 arxiv_id 或 corpus_id 匹配），则绑定到已有记录并补充缺失信息。

**Request Body:**

```json
{
  "arxiv_id": "2401.12345",       // 可选
  "corpus_id": "123456789",       // 可选
  "title": "Paper Title",         // 可选，手动创建时必填
  "authors": ["Author A", "Author B"],  // 可选
  "link": "https://example.com/paper",  // 可选，论文来源链接
  "tags": ["tag1", "tag2"]        // 可选，同时同步标签
}
```

- `arxiv_id` 和 `corpus_id` 至少提供一个，或提供 `title` 进行手动创建
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
  "listed": true                  // 可选，加入列表(true)/降为仅元数据(false)
}
```

- arXiv 论文（有 `arxiv_id`）尝试修改 `title` 或 `authors` 时返回 `400`
- `content` 为空字符串时清除 `user_input`
- 成功更新后 `updated_at` 自动刷新
- `listed: true` 时把论文加入列表并触发完整抓取管线；`listed: false` 始终允许（降为仅元数据）
- **列表资格**：仅有 OpenReview 链接、且无 `arxiv_id`/`corpus_id`（也无 arxiv.org 链接）的"OpenReview-only"论文不能被设为 `listed: true`，此时返回 `422`，错误码 `LISTING_NOT_ALLOWED`，`listed` 不变、不触发管线

**Response:** 返回更新后的论文对象（同 GET /papers/:id 格式）。响应含派生字段 `listable`（布尔）：`false` 表示该论文为 OpenReview-only、不可加入列表。

#### DELETE /papers/:id

彻底删除论文及所有关联数据。在单个事务中级联删除：qa_results → qa_entries → service_executions → paper_tags → highlights → paper。

**Response:**

```json
{
  "success": true,
  "deleted_id": 42
}
```

删除后 ID 不复用。论文不存在时返回 `404`。

#### GET /papers?arxiv_id=xxx 或 GET /papers?corpus_id=xxx

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

> 注：本 API 无"全量列表"端点，仅按 ID 精确查询。通过会议解析创建的"仅元数据"论文（`listed=0`，尚未加入阅读列表）也会被 lookup 命中（它们确已在库中、用于去重），但不会出现在站内论文列表里，直到被显式"加入列表"。

#### GET /papers/full

获取论文所有信息（包括 Q&A、Service 执行历史）。同步接口，开启 `auto_create` 或 `auto_template_qa` 时会等待所有操作完成后再返回（长 timeout）。

**查询方式（三选一）：**

| 参数 | 说明 |
|------|------|
| `?id=42` | 按内部 ID 查询 |
| `?arxiv_id=2401.12345` | 按 arXiv ID 查询 |
| `?corpus_id=123456789` | 按 corpus ID 查询 |

**可选参数（仅 arxiv_id / corpus_id 查询时生效）：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `auto_create` | `false` | 论文不存在时自动创建并触发抓取 |
| `auto_template_qa` | `false` | 自动执行缺失的模板提问（已有结果的跳过） |
| `exclude` | (无) | 排除指定字段，逗号分隔。如 `exclude=contents,services` |

**注意事项：**
- `auto_create=true` 时按所提供的 arxiv_id / corpus_id 创建并触发抓取。`semantic_scholar_service` 现在是**双向**的：带 arxiv_id 的论文会查 `ARXIV:{id}` 补全 corpus_id 与引用富化，**仅凭 corpus_id 创建的论文也会查 `CORPUSID:{id}` 反查 arxiv_id 并做同样的富化**（若该论文确实存在 arXiv 版本）；解析出 arxiv_id 后，arxiv 元数据/PDF 抓取会经依赖图自动衔接
- `auto_template_qa=true` 时，仅执行缺失的模板提问（和前端"一键生成"行为一致）
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
      "pdf_parsed": "We propose a new simple network architecture..."
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
    }
  ]
}
```

**Response:**

```json
{
  "results": [
    { "id": 42, "arxiv_id": "2401.12345", "created": true },
    { "id": 18, "corpus_id": "987654321", "created": false }
  ]
}
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
| Semantic Scholar URL | corpus_id | 备用匹配方式 |

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
