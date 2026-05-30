# conference-candidate-screening Specification

## Purpose
TBD - created by archiving change conference-candidate-screening. Update Purpose after archive.
## Requirements
### Requirement: Conference candidate API surfaces Semantic Scholar screening fields

`GET /api/conferences/:id/papers` SHALL attach, for each candidate that has a linked paper, that paper's abstract, TL;DR, citation count, and fields of study, derived from the linked paper (the source of truth) rather than copied onto `conference_papers`.

#### Scenario: Resolved candidate exposes S2 fields
- **WHEN** a candidate has a linked paper whose Semantic Scholar metadata includes an abstract and tldr
- **THEN** the candidate object in the response includes `paper_abstract`, `paper_tldr`, `paper_citation_count`, and `paper_fields_of_study` taken from that linked paper

#### Scenario: Unresolved candidate has null screening fields
- **WHEN** a candidate has no linked paper (`paper_id` is null)
- **THEN** `paper_abstract`, `paper_tldr`, `paper_citation_count`, and `paper_fields_of_study` are null

### Requirement: Candidate rows render as a screening card

The conference detail page SHALL render each candidate as a single card showing the title, a meta line (authors, citation count, fields of study), the S2 TL;DR, and the abstract clamped to a few lines with an expand/collapse control, so a paper can be triaged without leaving the page.

#### Scenario: Card shows abstract and TL;DR
- **WHEN** a candidate has `paper_abstract` and `paper_tldr`
- **THEN** the card shows the TL;DR and the abstract clamped to ~2–3 lines with a control to expand and collapse it

#### Scenario: Missing screening data degrades gracefully
- **WHEN** a candidate has no abstract or tldr
- **THEN** the card omits those sections and still shows the title, links row, and state

### Requirement: Unified external links row

Each candidate card SHALL present external links as a single row of link chips — arXiv, Semantic Scholar, and OpenReview — showing only those that exist, replacing the previously separate source badge, arXiv badge, S2 badge, and "来源" link.

#### Scenario: Resolved candidate shows all available links
- **WHEN** a candidate has a resolved arXiv id, a corpus id, and an OpenReview link
- **THEN** the card shows an arXiv chip (→ `arxiv.org/abs/{id}`), an S2 chip (→ Semantic Scholar `CorpusID:{id}`), and an OpenReview chip (→ its link)

#### Scenario: arXiv chip never renders as a dash
- **WHEN** a candidate has an arXiv id but no arxiv URL stored in `papers.link`
- **THEN** the arXiv chip renders a working link derived from the id and never renders as "-"

### Requirement: Candidate state is a derived three-state lifecycle

The conference detail UI SHALL present candidate state as exactly one of `待添加` / `仅元数据` / `已在库`, derived from `paper_id` and the linked paper's `listed` flag, and SHALL NOT surface a `pending`/`candidate` confirm/revert workflow.

#### Scenario: State derivation
- **WHEN** `paper_id` is null **THEN** the state is `待添加`
- **WHEN** `paper_id` is set and the linked paper's `listed` is false **THEN** the state is `仅元数据`
- **WHEN** the linked paper's `listed` is true (or `status` is `ingested`) **THEN** the state is `已在库`

#### Scenario: No confirm/revert controls
- **WHEN** viewing the candidate list
- **THEN** there are no `确认`/`退回` (pending↔candidate) controls and no "本次会议一键添加(candidate)" button

### Requirement: Checkbox selects candidates to add to the library

The row checkbox SHALL mean "select to 加入列表 (promote to library)". It SHALL be enabled for `仅元数据` candidates, checked-and-locked for `已在库` candidates, and disabled for `待添加` candidates. A bulk action SHALL promote all selected candidates' linked papers to the library in one request.

#### Scenario: In-library candidate is locked
- **WHEN** a candidate is `已在库`
- **THEN** its checkbox is shown checked and disabled, and it is not added to the selection set

#### Scenario: Metadata-only candidate is selectable and promotable in bulk
- **WHEN** one or more `仅元数据` candidates are selected and the user triggers "加入选中到列表"
- **THEN** a single request promotes each selected candidate's linked paper to `listed=true` and triggers its full pipeline

#### Scenario: Not-yet-resolved candidate cannot be selected
- **WHEN** a candidate is `待添加` (no linked paper)
- **THEN** its checkbox is disabled and it must be 解析 (resolved) before it can be added

### Requirement: Per-row primary action and overflow menu

Each candidate card SHALL show a primary action contextual to its state and an overflow menu for secondary actions, instead of a row of inline icon buttons.

#### Scenario: Metadata-only primary action
- **WHEN** a candidate is `仅元数据`
- **THEN** its primary action is "加入" (promote the linked paper to the library)

#### Scenario: In-library primary action
- **WHEN** a candidate is `已在库`
- **THEN** its primary action is "打开论文" linking to `/papers/{paper_id}`

#### Scenario: Secondary actions in overflow
- **WHEN** the user opens a candidate's `⋯` menu
- **THEN** it offers 编辑主题 and 删除

