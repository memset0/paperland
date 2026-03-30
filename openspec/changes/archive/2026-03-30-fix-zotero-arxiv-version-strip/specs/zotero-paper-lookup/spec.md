## MODIFIED Requirements

### Requirement: ArXiv ID extraction strips version suffix
The `extractArxivId()` function SHALL strip any version suffix (e.g. `v1`, `v3`, `v12`) from the extracted arXiv ID before returning it. The returned ID MUST be the base ID without version information.

#### Scenario: Modern format with version suffix in archiveID
- **WHEN** a Zotero item has archiveID `arXiv:2401.10774v3`
- **THEN** `extractArxivId()` returns `2401.10774`

#### Scenario: Modern format without version suffix
- **WHEN** a Zotero item has archiveID `arXiv:2401.10774`
- **THEN** `extractArxivId()` returns `2401.10774`

#### Scenario: Legacy format with version suffix in Extra field
- **WHEN** a Zotero item has Extra field containing `arXiv: cond-mat/0312345v2`
- **THEN** `extractArxivId()` returns `cond-mat/0312345`

#### Scenario: URL format with version suffix
- **WHEN** a Zotero item has URL `https://arxiv.org/abs/2301.12345v5`
- **THEN** `extractArxivId()` returns `2301.12345`

#### Scenario: Legacy URL format with version suffix
- **WHEN** a Zotero item has URL `https://arxiv.org/abs/hep-th/9901001v1`
- **THEN** `extractArxivId()` returns `hep-th/9901001`
