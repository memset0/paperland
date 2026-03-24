## Context

当前 papers 表没有 `link` 字段，论文来源信息仅通过 `arxiv_id` 和 `corpus_id` 间接体现。前端 PaperList 中有独立的 "arXiv ID" 列，仅显示 arxiv_id 文本，无法点击跳转，且非 arXiv 来源的论文无任何来源展示。

## Goals / Non-Goals

**Goals:**
- 为 papers 表新增 `link` 字段，统一存储论文原始来源 URL
- arXiv 论文自动从 arxiv_id 生成 link（`https://arxiv.org/abs/{arxiv_id}`）
- 回填已有 arxiv_id 论文的 link
- 前端 "arXiv ID" 列改造为"来源"列，以彩色标签形式展示
- 手动创建和 API 创建论文时支持传入 link

**Non-Goals:**
- 不修改 Zotero 插件（后续可扩展）
- 不自动从非 arXiv 来源抓取 link
- 不改变 papers.cool 链接逻辑（PaperDetail 页面已有独立的 papers.cool 跳转）

## Decisions

### 1. link 字段存储完整 URL

link 字段存储完整的 URL 字符串（如 `https://arxiv.org/abs/2306.13649`），而非仅存储域名或路径。

**理由**：完整 URL 可直接用于跳转，无需运行时拼接。arXiv 链接虽然可以从 arxiv_id 动态生成，但统一存储完整 URL 简化了前端渲染逻辑——前端无需关心来源类型即可直接跳转。

**替代方案**：仅存域名+路径，运行时根据类型拼接 → 增加前端复杂度，无明显收益。

### 2. arXiv link 由后端 arxiv_service 自动设置

在 arxiv_service 执行时（已有 `depends_on: ['arxiv_id']`），自动设置 `link = https://arxiv.org/abs/{arxiv_id}`，仅在 link 为空时写入。

**理由**：复用现有服务执行流程，无需额外触发机制。服务已经在处理 arxiv 元数据，顺便设置 link 是最自然的位置。

**替代方案**：在创建论文时同步设置 → 但 arxiv_id 可能在创建后由 semantic_scholar_service 补充，此时 link 不会被设置。

### 3. 数据回填通过一次性 migration 脚本

在 Drizzle migration 中，先添加 `link` 列，再执行 UPDATE 语句将已有 arxiv_id 论文的 link 填充为 `https://arxiv.org/abs/{arxiv_id}`。

**理由**：migration 是最可靠的一次性数据修补方式，确保部署后立即生效。

### 4. 前端来源标签的样式策略

- arXiv 来源：检测 link 是否匹配 `arxiv.org` 域名，显示红色标签 `arxiv:{id}`
- 其他来源：从 URL 提取域名，显示灰色标签
- 无来源：显示 `-`

**理由**：前端通过 link URL 判断类型，而非依赖 arxiv_id 字段，保持单一数据源。标签颜色区分帮助用户快速识别论文来源。

### 5. 创建论文 API 新增可选 link 参数

内部 API（`POST /api/papers`）和外部 API（`POST /external-api/v1/papers`）均新增可选 `link` 字符串参数。如果同时提供了 arxiv_id 和 link，以用户提供的 link 为准（不覆盖）。

## Risks / Trade-offs

- **[link 与 arxiv_id 不一致]** → 用户可能手动设置了 link，之后 arxiv_service 运行时不应覆盖。Mitigation：arxiv_service 仅在 link 为空时设置。
- **[migration 回填性能]** → 对大量论文执行 UPDATE。Mitigation：SQLite 单表更新速度足够，且是一次性操作。
- **[前端 URL 解析]** → 从 URL 提取域名可能遇到异常格式。Mitigation：使用 `new URL()` 解析，异常时 fallback 显示完整 URL。
