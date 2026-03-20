# Paperland External API

## 概述

External API 是独立于前端 Internal API 的第三方接口，主要用于 Zotero 插件等外部服务与 Paperland 进行数据同步。

---

## 认证

### 获取 Token

用户在 Paperland 前端「设置」页面申请 Auth Token，复制后配置到第三方服务中。

### 使用 Token

所有 External API 请求需在 Header 中携带 Token：

```
Authorization: Bearer <token>
```

未携带或 Token 无效时返回 `401 Unauthorized`。

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
- `auto_create=true` 时，通过 corpus_id 可能解析出 arxiv_id，如果该 arxiv_id 已存在则合并到已有条目（不会重复创建）
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
    "metadata": {},
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
Zotero 插件
    │
    ├── 1. 遍历 Zotero 中选中的文章
    │      提取 arxiv_id / DOI / corpus_id
    │
    ├── 2. POST /external-api/v1/papers/batch
    │      批量创建/绑定论文
    │
    ├── 3. PUT /external-api/v1/papers/:id/tags
    │      同步每篇论文的 Zotero 标签
    │
    └── 4. (未来) 内嵌 Webview 展示论文详情页
           直接使用 Paperland 前端，无需额外 API
```

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
