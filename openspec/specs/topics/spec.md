# topics Specification

## Purpose

Provide maintainable research Topics with versioned documents, a stable numbered global reference catalog, per-page subsets, explicit import and a browser-local reading experience.

## Requirements

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
Topics SHALL support bounded Markdown documents and readable legacy history, with pages/report.md as the schema v1 home. Navigation SHALL include Research questions and All references. A themed center card SHALL render the selected page with a default-collapsed reference subset and no permanent reference rail. Phone navigation SHALL avoid horizontal overflow. Relative links SHALL preserve Topic/history context.

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
The left navigation SHALL follow the ordered reports.yml tree for schema v1, with folder-derived fallback for legacy commits. A group with an index document SHALL appear once, with separate page and expansion controls. Frontmatter title and fonticon SHALL control each document's display label/icon, with safe defaults. Root README SHALL not replace the research report. The center SHALL reserve sidebar space and use a readable maximum width around680px on desktop.

#### Scenario: Nested research pages
- **WHEN** pages/research/rq6.md declares a title and icon
- **THEN** it SHALL appear at its manifest location, or under the Research folder in a legacy commit with that metadata and open in the center card

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
Schema v1 references.json SHALL define each work once with a stable ID/number and source. Multiple report frontmatter lists MAY include the same number without copying reference metadata. Distinct versions treated as different works, including HexaShell Preview and Universal/v3, SHALL retain separate identities.

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

### Requirement: Archive a Topic
The Topic owner SHALL be able to archive and unarchive a Topic. Archiving SHALL record the archive time, and unarchiving SHALL clear it. Non-owners SHALL NOT change the archive state. Archived Topics SHALL remain in Topic lists and SHALL be readable by everyone who could read them before, including history, documents and explicit paper import into the reader's own library. Lists and details SHALL include `archived_at` (null when not archived).

#### Scenario: Archived Topic stays listed
- **WHEN** the owner archives a Topic
- **THEN** the Topic SHALL still appear in the Topics list for its readers, marked "Archived"

#### Scenario: Archived Topics are listed separately
- **WHEN** a reader opens the web Topics list and some listed Topics are archived
- **THEN** archived Topics SHALL appear only in a separate "Archived" group with its count, not mixed with active Topics

#### Scenario: Non-owner cannot archive
- **WHEN** an editor who is not the owner tries to archive the Topic
- **THEN** the request SHALL be refused and nothing SHALL change

#### Scenario: Unarchive
- **WHEN** the owner unarchives an archived Topic
- **THEN** it SHALL be editable again by its editors

### Requirement: Topics list URL
The web Topics list SHALL live at `/topics`, and the sidebar and in-app links SHALL point there. The old `/research` list URL SHALL redirect to `/topics`, keeping its query string. Research history (`/research/history`) and old research sessions (`/research/:id`) SHALL keep their URLs.

#### Scenario: Old list link redirects
- **WHEN** a user opens `/research?new=1&seed_result=42`
- **THEN** the browser SHALL land on `/topics?new=1&seed_result=42` and the new-topic dialog SHALL open from that answer

### Requirement: Archived Topics are read-only
While a Topic is archived, its content SHALL NOT change: renaming SHALL be refused with an error saying the Topic is archived, and Git pushes SHALL be refused (see topic-git). Sharing, member and own-credential management SHALL keep working. The Topic page SHALL show an "Archived" notice and SHALL hide rename and other edit affordances while archived, and the owner SHALL see an Unarchive action.

#### Scenario: Rename refused
- **WHEN** an editor renames an archived Topic
- **THEN** the request SHALL fail with a message that the Topic is archived and the title SHALL stay unchanged

#### Scenario: Sharing still adjustable
- **WHEN** the owner changes the default access of an archived Topic
- **THEN** the change SHALL be applied

### Requirement: Topics list layout
The web Topics list SHALL show Topics in shadcn cards (title, up to two lines of description, owner, last update, and the reader's role only when it is not Owner), with Mine/All and search above. Active and archived Topics SHALL be on separate "Active" and "Archived (N)" tabs. While loading, skeleton cards SHALL be shown. Each tab SHALL have its own empty state.

#### Scenario: Archived Topics on their own tab
- **WHEN** a reader opens the Topics list and one listed Topic is archived
- **THEN** it SHALL appear only on the "Archived (1)" tab and not among the active cards

#### Scenario: Search across tabs
- **WHEN** a reader searches and matches exist only among archived Topics
- **THEN** the Archived tab count SHALL reflect the matches and the Active tab SHALL say no active topics match

### Requirement: Topic page header
The Topic page SHALL show a breadcrumb back to Topics, the title with History and Share buttons, and a "More actions" menu for the remaining actions (All references, Browse linked papers, Refresh, Rename, Original research, Archive/Unarchive), each offered only when permitted. Owner, role, last update, reference count and short commit SHALL share one meta line. Archived and historical-version states SHALL be alerts. Rename SHALL use a dialog.

#### Scenario: Owner archives from the menu
- **WHEN** the owner opens "More actions" on an active Topic and chooses Archive, then confirms
- **THEN** the Topic SHALL be archived and the archived alert SHALL appear

#### Scenario: Viewer sees no edit actions
- **WHEN** a viewer opens "More actions"
- **THEN** Rename and Archive SHALL NOT be offered
