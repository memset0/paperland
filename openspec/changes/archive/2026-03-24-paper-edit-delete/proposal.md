## Why

论文详情页目前只能查看论文信息，无法编辑或删除。用户需要能够修改论文的基本信息（标题、作者、链接）和内容（user input），以及从文献库中彻底删除不需要的论文。对于从 arXiv 导入的论文，标题和作者应锁定不可编辑，因为这些信息来自权威来源。

## What Changes

- **论文编辑功能**：在论文详情页添加编辑模式，支持修改：
  - 标题、作者、链接（仅限手动添加的论文；arXiv 导入的论文锁定标题和作者）
  - 论文内容（user_input）：使用等宽字体的纯文本编辑器（非 Markdown 编辑器）
  - 对于 arXiv 论文，编辑内容对应 contents 中的 `user_input` 字段（即 "content user uploaded"）
- **论文删除功能**：支持彻底删除论文，包括：
  - 删除前弹出确认对话框，要求用户输入论文的内部 ID（类似 GitHub 删除仓库的确认机制）
  - 级联删除该论文下的所有 Q&A 条目、Q&A 结果、服务执行记录、标签关联、高亮标注
  - 删除后 ID 不复用，重新添加同一论文会分配新 ID
- **后端 API**：在内部 API 和外部 API 中添加 PUT/PATCH 和 DELETE 端点
- **来源标签组件**：将论文列表中的来源标签（arXiv 红色标签/域名灰色标签）封装为独立组件，在论文详情页复用，替代当前详情页中的 arxiv 标签，支持点击跳转到论文来源链接

## Capabilities

### New Capabilities
- `paper-edit`: 论文基本信息和内容的编辑功能，包括前端编辑界面和后端更新 API
- `paper-delete`: 论文删除功能，包括确认机制、级联删除、前后端端点

### Modified Capabilities
- `database-schema`: 需要确保外键级联删除约束正确设置

## Impact

- **后端**：`packages/backend/src/api/papers.ts` 新增 PUT 和 DELETE 端点；`packages/backend/src/external-api/papers.ts` 同步新增
- **前端**：`packages/frontend/src/views/PaperDetail.vue` 添加编辑/删除 UI；`packages/frontend/src/stores/papers.ts` 新增 updatePaper/deletePaper 方法
- **数据库**：可能需要新迁移来添加级联删除约束（当前 schema 中外键可能未设置 ON DELETE CASCADE）
- **共享类型**：`packages/shared/src/types.ts` 可能需要新增 UpdatePaper 请求类型
- **文档**：更新 `docs/frontend-architecture.md` 和 `docs/external-api.md`
