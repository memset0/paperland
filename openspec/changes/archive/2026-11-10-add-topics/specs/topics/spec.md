## Purpose

Provide maintainable research Topics with versioned documents, a stable numbered global reference catalog, per-page subsets, explicit import and a browser-local reading experience.

## ADDED Requirements

### Requirement: Topic creation and navigation
Authenticated users SHALL create Topics with a title and optional description, list owned/shared Topics, and open a Topic detail page. Topics SHALL replace the existing Research navigation entry and use AppPage with English labels. Legacy Research sessions SHALL remain accessible through history without deleting their data.

#### Scenario: Create and open a Topic
- **WHEN** a signed-in user creates a Topic
- **THEN** an initialized repository and readable first version SHALL exist, owned by that user
- **AND** the original Research navigation entry SHALL lead to Topics, with legacy research accessible through history

### Requirement: One coherent report and paper list
A Topic version SHALL contain a main Markdown report, optional supplementary pages and one global catalog with stable entry identities and numbers. Legacy directory data SHALL remain compatible. Current and historical documents/catalogs SHALL come from the same commit, and native paper/PDF links SHALL work.

#### Scenario: Browse an older version
- **WHEN** a reader selects a historical commit
- **THEN** its report, title, directory names, ordering and paper entries SHALL be rendered together
- **AND** current search associations SHALL NOT be replaced by historical associations

### Requirement: Semantic Scholar external entries
The list SHALL accept existing Paperland paper IDs, external Semantic Scholar identifiers and preserved HTTP(S) reference links with citation metadata. Directory descriptions and entry comments SHALL remain readable Markdown. External references SHALL not create papers, join personal libraries or contact external services during push validation.

#### Scenario: Push an external entry
- **WHEN** a valid list contains an external Semantic Scholar entry
- **THEN** the push SHALL succeed and its title and Semantic Scholar link SHALL display without automatic ingestion

### Requirement: Explicit one-click paper import
An authenticated Topic reader SHALL be able to explicitly import an external entry into their own Paperland library with one action. Existing identifiers SHALL deduplicate. Successful import SHALL connect the current Topic's relevant hierarchical associations to the site paper without rewriting Git history or changing another user's library.

#### Scenario: Import an external entry
- **WHEN** a reader clicks the external entry's import action
- **THEN** the existing ingestion behavior SHALL create/find the paper and add it to that reader's library
- **AND** the Topic SHALL offer a native paper link and current hierarchical filtering for the imported paper

#### Scenario: Import fails
- **WHEN** explicit import fails
- **THEN** the external entry and published Topic version SHALL remain readable and the UI SHALL show an English actionable error

### Requirement: Last displayed content cache
The browser SHALL cache the content and version actually rendered for each account and Topic page. Latest content SHALL display directly. Cache reads/writes SHALL tolerate unavailable storage, corrupt data and quota errors. Historical views SHALL NOT overwrite the latest-view baseline or expose another account's cache.

#### Scenario: Several pushes between visits
- **WHEN** a reader returns after multiple updates
- **THEN** additions SHALL be compared against their last displayed content, rather than only the preceding commit

### Requirement: Animate pure additions together
New paper rows and pure inserted Markdown blocks SHALL animate together after the latest view renders. Unchanged, edited and deleted content SHALL receive no additional animation. No cache or entirely new content SHALL render without transitions. The cache SHALL advance after rendering so repeat visits do not repeat animations.

#### Scenario: Insertions among familiar content
- **WHEN** an update inserts report blocks and paper rows among previously displayed content
- **THEN** those additions SHALL enter simultaneously without first displaying the old version

#### Scenario: First or entirely new view
- **WHEN** there is no usable cache or no matching previous content
- **THEN** the latest content SHALL display without entry animation

#### Scenario: Repeat the same visit
- **WHEN** the same version is displayed again after the cache was saved
- **THEN** no addition animation SHALL repeat

### Requirement: Web Topic rename
Owners and editors SHALL rename the latest Topic from its detail page. A rename SHALL create a Git version changing only topic.json, preserve the report/list/README and stable associations, and update the root tag name atomically. Viewers and historical views SHALL not offer this mutation. A stale base commit SHALL fail without overwriting newer work or discarding the user's typed name.

#### Scenario: Shorten a migrated name
- **WHEN** an editor saves a shorter Topic name against the current commit
- **THEN** the Topic list/detail and root badge SHALL show it, while prior versions retain their names

#### Scenario: Concurrent push while renaming
- **WHEN** a push advances the Topic after the rename editor was opened
- **THEN** the stale rename SHALL be rejected and the user SHALL retain their typed name for retry

### Requirement: One-time legacy results import
The migration script SHALL create one Topic per legacy session and preserve every valid result version in Git, with original ownership, report, ordered paper/link list, directory descriptions and comments. Existing source records SHALL remain unchanged. Migration SHALL use local metadata only and SHALL not create papers or invoke providers.

#### Scenario: Import old results
- **WHEN** the one-time migration is applied
- **THEN** all source result versions SHALL be readable as Topic history, including URL citations and section descriptions

### Requirement: Resumable and non-destructive migration
Dry run SHALL be read-only. Applied migration SHALL create a consistent backup and persistent session/step mappings, hide incomplete Topics, and safely resume interrupted publication without duplicating Topics/versions. Repeating a completed migration SHALL preserve later user edits. Private sessions SHALL stay private; previously shared sessions SHALL preserve current readers as viewers.

#### Scenario: Retry after interruption or user rename
- **WHEN** migration is rerun after an interruption or after a completed Topic was renamed
- **THEN** unfinished work SHALL resume once and completed Topics SHALL not be reset

### Requirement: Research pages and per-page references
Topics SHALL support bounded Markdown documents and readable v1 history, with pages/report.md as the v2 home. Navigation SHALL include Research questions and All references. A themed center card SHALL render the selected page with a default-collapsed reference subset and no permanent reference rail. Phone navigation SHALL avoid horizontal overflow. Relative links SHALL preserve Topic/history context.

#### Scenario: Open a supplementary report
- **WHEN** a reader selects pages/methods.md
- **THEN** its Markdown body and only its assigned reference numbers SHALL display from the same commit

### Requirement: Frontmatter reference subsets
Each document MAY declare a YAML frontmatter references list of unique positive integers. The list SHALL be a subset of that commit's global catalog. The header SHALL not render as report prose. A legacy main report without the field SHALL keep all catalog entries available; an additional document without the field SHALL have an empty subset. New Topics SHALL initialize a Research questions document without invented research content.

#### Scenario: Invalid reference number
- **WHEN** an introduced document declares a reference number absent from its catalog
- **THEN** the entire push SHALL fail without publishing any partial page, list or tag update

### Requirement: Global stable numbered catalog
All site papers, Semantic Scholar entries and URL references SHALL share one Topic catalog and number sequence. Numbers SHALL follow first Topic appearance, including multiple updates between reads, independently of publication date or later file ordering. Existing identities SHALL retain numbers; removed numbers SHALL remain reserved and SHALL not be reused for different references. Every document SHALL reuse this catalog rather than duplicate reference metadata.

#### Scenario: Old publication added later
- **WHEN** a 2010 paper enters the Topic after a 2025 paper
- **THEN** it SHALL receive a later reference number regardless of publication year

### Requirement: Cache only displayed reader surfaces
Reading baselines SHALL be separate for each document, its displayed reference subset and the global References view. Hidden pages and unopened mobile drawers SHALL NOT be marked displayed. Revealing them SHALL compare against their own last displayed baseline; first/all-new content and repeated displays SHALL not animate. Latest updates SHALL still display immediately and historical views SHALL not advance latest caches.

#### Scenario: Update a hidden page
- **WHEN** new paragraphs/references arrive while another page is selected
- **THEN** opening the changed page SHALL compare with its last actually displayed content, without treating hidden updates as already read

### Requirement: Folder-derived navigation and document metadata
The left navigation SHALL derive its tree from folders under pages/. Frontmatter title and fonticon SHALL control each document's display label/icon, with safe defaults. Root README SHALL not replace the research report. The center SHALL reserve sidebar space and use a readable maximum width around680px on desktop.

#### Scenario: Nested research pages
- **WHEN** pages/research/rq6.md declares a title and icon
- **THEN** it SHALL appear under the Research folder with that metadata and open in the center card

### Requirement: First-class document routes
Document routes SHALL omit the pages/ prefix, .md suffix and file query, such as /topics/3/discussions. Home SHALL use /topics/3. Legacy query links and selected historical versions SHALL remain usable without exposing arbitrary workspace files.

#### Scenario: Follow an existing file link
- **WHEN** a reader opens /topics/3?file=pages/discussions.md
- **THEN** the page SHALL redirect to its canonical document route and retain any selected version

### Requirement: Separate global references and citation presentation
All references SHALL have a separate entry opening a right drawer without replacing the selected document. Per-page references SHALL remain a catalog subset. Numeric reference links SHALL have a distinct citation style and open the corresponding paper card on hover/focus or click/tap. Cards SHALL offer explicit import for supported external paper entries and a reference locator. Ordinary and native PDF links SHALL preserve their behavior.

#### Scenario: Read beside the catalog
- **WHEN** a reader opens All references while reading RQ6
- **THEN** the full catalog SHALL appear in the right drawer while RQ6 remains selected
- **AND** hidden drawers SHALL not advance reading caches

### Requirement: Preserve the original report as a current page
Topic3's pre-split full report SHALL remain a current first-class background page under pages/, in addition to immutable history. RQ0-RQ7 and their index SHALL live together under pages/research-questions/. The default document SHALL be pages/report.md, never README.md.

#### Scenario: Open original research beside new briefs
- **WHEN** a reader selects the original-report page in the current tree
- **THEN** the pre-split report SHALL render with its applicable current global-reference subset

### Requirement: References reused across reports
V2 references.json SHALL define each work once with a stable ID/number and source. Multiple report frontmatter lists MAY include the same number without copying reference metadata. Distinct versions treated as different works, including HexaShell Preview and Universal/v3, SHALL retain separate identities.

#### Scenario: Shared COAP and EAT references
- **WHEN** RQ3 and RQ6 both discuss COAP and EAT
- **THEN** both SHALL select the same global numbers for those works

### Requirement: Citation hover cards and explicit import
Numeric body references SHALL open the corresponding catalog paper card on hover or keyboard focus, with click/tap support. Readers SHALL move into it and use one-click import without navigation or premature dismissal. Cards SHALL use current authenticated access and personal-library state, close on stale document/version/account changes, and preserve native/source links. Hover alone SHALL not ingest papers.

#### Scenario: Import an external paper from a citation
- **WHEN** a reader hovers a number for an external S2 or recognized arXiv-paper entry and selects Import paper
- **THEN** the site SHALL create/find that paper in the reader's library and update the open card to its native/added state
- **AND** Git source, number and report version SHALL remain unchanged

#### Scenario: Keyboard or touch citation
- **WHEN** a reader focuses or taps a valid numeric reference
- **THEN** its card and import/open actions SHALL be reachable without requiring hover

### Requirement: Folded page references
The page reference section SHALL default to closed, without a permanent right rail. Opening cards SHALL not mark the whole folded list displayed. Document/version/account changes SHALL reset the fold. Global references SHALL remain available in their independent right drawer.

#### Scenario: Read before unfolding references
- **WHEN** a new version arrives while the list stays folded
- **THEN** latest prose SHALL display and its list baseline SHALL stay at the last unfolded content until the reader reveals it

### Requirement: Wider compact document tree
Desktop document navigation SHALL have enough width for readable titles and tighter row spacing/indentation, while retaining folder hierarchy, current selection and the680px report cap. Narrow layouts SHALL keep the existing page drawer without horizontal overflow.

#### Scenario: Scan the question list
- **WHEN** a reader opens the expanded research-question folder on desktop
- **THEN** the tree SHALL use the wider navigation track and compact rows with readable text, rather than forcing ordinary short question titles to wrap
