## ADDED Requirements

### Requirement: doc2x 翻译服务注册为 pure 服务
系统 SHALL 注册两个 pure（手动触发）服务 `doc2x_translate_zh` 与 `doc2x_translate_bilingual`，二者**不**纳入 paper-bound 依赖图，不在论文创建时被自动调度。

#### Scenario: 注册为 pure 服务
- **WHEN** 系统启动并注册所有服务
- **THEN** `doc2x_translate_zh` 与 `doc2x_translate_bilingual` SHALL 出现在 ServiceRunner 已注册服务列表中，类型为 `pure`，并各自受其 `max_concurrency` 与 `rate_limit_interval` 约束

#### Scenario: 论文创建时不自动触发
- **WHEN** 新建论文或调用 `triggerForPaper`（paper-bound 依赖图调度）
- **THEN** 系统 SHALL NOT 为这两个 doc2x 服务自动创建执行记录

### Requirement: 按需调用 doc2x CLI 翻译论文 PDF
系统 SHALL 在收到对应模式的触发时，用 `config.yml` 中该服务的命令模板调用 doc2x CLI，把论文的 `pdf_path` 翻译为 PDF。

#### Scenario: 中文单语翻译
- **WHEN** 以 `mode=zh` 触发且论文存在 `pdf_path`
- **THEN** 系统 SHALL 用 `doc2x_translate_zh.command` 调用 doc2x CLI，产出保留排版的中文 PDF

#### Scenario: 中英双语翻译
- **WHEN** 以 `mode=bilingual` 触发且论文存在 `pdf_path`
- **THEN** 系统 SHALL 用 `doc2x_translate_bilingual.command` 调用 doc2x CLI，产出中英双语 PDF

#### Scenario: 缺少源 PDF
- **WHEN** 论文没有 `pdf_path`
- **THEN** 系统 SHALL 返回错误且不调用 doc2x CLI

#### Scenario: 命令占位符替换
- **WHEN** 拼接 doc2x 命令
- **THEN** 命令模板中的 `{INPUT}` / `{OUTDIR}` / `{NAME}` SHALL 分别被替换为源 PDF 的绝对路径、输出目录、确定性输出文件名（无扩展名）

### Requirement: 翻译结果磁盘缓存
翻译产物 SHALL 落盘到 `data/pdfs/translated/` 并把相对 cwd 的路径写入 `paper.metadata.doc2x`；已缓存时 SHALL 跳过重复翻译。

#### Scenario: 缓存未命中则翻译并记录
- **WHEN** 该模式尚无缓存且收到触发
- **THEN** 翻译完成后系统 SHALL 把产物路径写入 `paper.metadata.doc2x.zh_pdf_path` 或 `bilingual_pdf_path`

#### Scenario: 缓存命中则跳过
- **WHEN** `metadata.doc2x.<mode>_pdf_path` 指向的文件存在且未设置 `force`
- **THEN** 系统 SHALL 直接返回该缓存路径，不再调用 doc2x CLI

#### Scenario: 强制重新翻译
- **WHEN** 触发时 `force=true`
- **THEN** 系统 SHALL 忽略缓存重新翻译并覆盖旧产物

#### Scenario: 输出路径发现
- **WHEN** doc2x CLI 执行结束
- **THEN** 系统 SHALL 优先解析 doc2x `--json` 输出中的导出路径，兜底检查 `{OUTDIR}/{NAME}.pdf` 是否存在，以确定缓存路径

### Requirement: 翻译状态与触发 API
系统 SHALL 提供 `GET /api/papers/:id/translations` 与 `POST /api/papers/:id/translations`。

#### Scenario: 查询合并状态
- **WHEN** `GET /api/papers/:id/translations`
- **THEN** 系统 SHALL 返回 `zh` 与 `bilingual` 各自的 `{ status, pdf_path, error }`，其中 `status` 取值 `idle` / `pending` / `running` / `done` / `failed`（缓存文件存在为 `done`+`pdf_path`）

#### Scenario: 触发翻译
- **WHEN** `POST /api/papers/:id/translations` body 含合法 `mode` 且无可用缓存
- **THEN** 系统 SHALL 创建一条该服务的 `service_executions` 记录并返回 `execution_id`

#### Scenario: 触发命中缓存
- **WHEN** `POST` 触发的模式已有缓存且未设 `force`
- **THEN** 系统 SHALL 直接返回 `{ status: 'done', pdf_path }` 而不新建执行

#### Scenario: 去重进行中的翻译
- **WHEN** 该 paper+mode 已存在 `pending` 或 `running` 的执行
- **THEN** 触发请求 SHALL 复用该执行，不重复启动 doc2x 进程

#### Scenario: 论文不存在
- **WHEN** `:id` 对应论文不存在
- **THEN** 系统 SHALL 返回 404

### Requirement: CLI 可用性与认证错误处理
系统 SHALL 把 doc2x CLI 缺失、未登录、翻译失败、超时分别映射为明确的失败原因。

#### Scenario: CLI 未安装
- **WHEN** 启动 doc2x 进程失败（ENOENT）
- **THEN** 执行 SHALL 标记 failed，error 提示需先安装 doc2x CLI

#### Scenario: 未登录
- **WHEN** doc2x CLI 以退出码 `2`（认证失败）退出
- **THEN** 执行 SHALL 标记 failed，error 提示需先在终端运行 `doc2x login`

#### Scenario: 翻译失败
- **WHEN** doc2x CLI 以其他非零退出码退出
- **THEN** 执行 SHALL 标记 failed，error 含截断后的 stderr

#### Scenario: 超时
- **WHEN** doc2x 执行超过配置的 `timeout`
- **THEN** 系统 SHALL 杀掉进程并把执行标记 failed

### Requirement: doc2x 服务配置
`config.yml` SHALL 支持为两个 doc2x 服务配置 `command`、`auth_mode`、`timeout` 以及 `max_concurrency` / `rate_limit_interval`。

#### Scenario: 使用命令模板
- **WHEN** 服务配置了 `command`
- **THEN** 调用 doc2x 时 SHALL 按该模板拼接命令

#### Scenario: 默认超时
- **WHEN** 服务未配置 `timeout`
- **THEN** 系统 SHALL 使用默认超时（如 600 秒）
