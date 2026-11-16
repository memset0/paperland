## MODIFIED Requirements

### Requirement: Research pages and per-page references
Topics SHALL support bounded Markdown documents and readable legacy history, with pages/report.md as the schema v1 home. Navigation SHALL include Research questions and All references. A themed center card SHALL render the selected page with a default-collapsed reference subset and no permanent reference rail. Phone navigation SHALL avoid horizontal overflow. Relative links SHALL preserve Topic/history context.

#### Scenario: Open a supplementary report
- **WHEN** a reader selects pages/methods.md
- **THEN** its Markdown body and only its assigned reference numbers SHALL display from the same commit

### Requirement: Folder-derived navigation and document metadata
The left navigation SHALL follow the ordered reports.yml tree for schema v1, with folder-derived fallback for legacy commits. A group with an index document SHALL appear once, with separate page and expansion controls. Frontmatter title and fonticon SHALL control each document's display label/icon, with safe defaults. Root README SHALL not replace the research report. The center SHALL reserve sidebar space and use a readable maximum width around680px on desktop.

#### Scenario: Nested research pages
- **WHEN** pages/research/rq6.md declares a title and icon
- **THEN** it SHALL appear at its manifest location, or under the Research folder in a legacy commit with that metadata and open in the center card

### Requirement: References reused across reports
Schema v1 references.json SHALL define each work once with a stable ID/number and source. Multiple report frontmatter lists MAY include the same number without copying reference metadata. Distinct versions treated as different works, including HexaShell Preview and Universal/v3, SHALL retain separate identities.

#### Scenario: Shared COAP and EAT references
- **WHEN** RQ3 and RQ6 both discuss COAP and EAT
- **THEN** both SHALL select the same global numbers for those works
