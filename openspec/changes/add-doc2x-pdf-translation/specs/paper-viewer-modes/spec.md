## MODIFIED Requirements

### Requirement: Multi-mode viewer in wide layout
The paper detail page left panel SHALL support multiple viewing modes via a tab bar. Each mode renders different content in the same viewer area. The tab order SHALL be: `PDF 原文 → 中文翻译 → 中英对照 → 幻觉翻译`.

#### Scenario: PDF mode displayed
- **WHEN** a paper has a `pdf_path`
- **THEN** the viewer SHALL show a "PDF 原文" tab that renders the PDF in an iframe (existing PdfViewer behavior)

#### Scenario: Chinese translation mode displayed
- **WHEN** a paper has a `pdf_path`
- **THEN** the viewer SHALL show a "中文翻译" tab for the doc2x Chinese-translated PDF (mode `zh`)

#### Scenario: Bilingual mode displayed
- **WHEN** a paper has a `pdf_path`
- **THEN** the viewer SHALL show a "中英对照" tab for the doc2x bilingual PDF (mode `bilingual`)

#### Scenario: Translation (hallucination) mode displayed
- **WHEN** a paper has an `arxiv_id`
- **THEN** the viewer SHALL show a "幻觉翻译" tab that renders `https://hjfy.top/arxiv/{arxiv_id}` in an iframe

#### Scenario: Tab ordering
- **WHEN** multiple modes are available
- **THEN** the "中文翻译" and "中英对照" tabs SHALL appear before the "幻觉翻译" tab, with "PDF 原文" first

#### Scenario: Mode switching
- **WHEN** the user clicks a different tab in the viewer tab bar
- **THEN** the viewer content SHALL switch to the selected mode's content immediately

#### Scenario: Auto-select first available mode
- **WHEN** the viewer panel loads
- **THEN** the first available mode SHALL be selected by default

#### Scenario: No modes available
- **WHEN** a paper has neither `pdf_path` nor `arxiv_id`
- **THEN** the viewer area SHALL show a placeholder message indicating no viewer content is available

## ADDED Requirements

### Requirement: doc2x 翻译 tab 的状态展示
「中文翻译」与「中英对照」tab SHALL 根据该模式的翻译状态分别展示，且打开 tab 时 SHALL NOT 自动开始翻译（手动触发）。

#### Scenario: 未翻译 — 手动触发
- **WHEN** 该模式尚无缓存翻译且无进行中的执行
- **THEN** tab 内 SHALL 显示「开始翻译」按钮，仅在用户点击后才发起翻译

#### Scenario: 翻译进行中
- **WHEN** 该模式翻译处于 `pending` 或 `running`
- **THEN** tab 内 SHALL 显示进行中状态（spinner / 进度），并按短轮询刷新翻译状态

#### Scenario: 翻译完成 — 渲染 PDF
- **WHEN** 该模式已有缓存翻译 PDF
- **THEN** tab 内 SHALL 用 PdfViewer 渲染该翻译 PDF（经 `/api/files/` 加载）

#### Scenario: 翻译失败 — 可重试
- **WHEN** 该模式翻译失败
- **THEN** tab 内 SHALL 显示错误信息与「重试」按钮，点击后重新触发翻译

#### Scenario: 可用性依赖源 PDF
- **WHEN** 论文没有 `pdf_path`
- **THEN** 「中文翻译」与「中英对照」tab SHALL 不可用（不显示）
