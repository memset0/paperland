# Tasks

## 1. Format, configuration and persistence

- [x] 1.1 Define shared Topic models and strict v1 repository parsing; verify offline fixtures cover IDs, nested/multi-directory entries, S2 references, cycles and invalid content.
- [x] 1.2 Add validated Topic/Git/PDF configuration and additive Drizzle persistence/counter fields; verify defaults, migration on a disposable consistent database copy and preservation of existing data.
- [x] 1.3 Document the repository contract, persistent paths and schema in docs/tech-stack.md and docs/external-api.md; verify examples against the parser and preserve concurrent edits.

## 2. Access, credentials and aggregate counts

- [x] 2.1 Implement centralized Topic ACLs and owner-managed memberships; verify owner/editor/viewer/non-member/inactive-user cases with offline tests.
- [x] 2.2 Implement hashed per-user Topic credential issue/list/rotate/revoke and shared MCP/Git authentication; verify cross-Topic denial, permission downgrade, secret non-disclosure and existing credential compatibility offline.
- [x] 2.3 Instrument all known MCP tool attempts with atomic user and optional Topic counters, including Q&A/Research agent contexts; verify zeros, failures, batches, concurrent increments and rotation persistence with offline tests.
- [x] 2.4 Document permissions, credential use and counter semantics in docs/external-api.md and docs/tech-stack.md; verify examples match accessible endpoints.

## 3. Git versions and publication

- [x] 3.1 Initialize bare repositories and expose authenticated smart HTTP reads/writes with staging and per-Topic serialization; verify actual local Git clone/pull/push with offline client/server tests.
- [x] 3.2 Validate all introduced commits and enforce safe files, refs and resource bounds; verify malformed/intermediate/unsafe/oversized commits, force/deletion attempts and concurrent stale pushes preserve the accepted version.
- [x] 3.3 Persist prepared publication journals, authenticated push audit, metadata and complete current snapshots; verify injected interruption recovery is idempotent and never mixes report/list/index versions.
- [x] 3.4 Document Git connection, conflict, history and recovery operations in docs/external-api.md and docs/tech-stack.md; verify the documented maintenance workflow against a disposable repository.

## 4. Topic and PDF APIs/MCP

- [x] 4.1 Implement Topic create/list/detail/history, authorized QA seed, member/own-token APIs and explicit S2-entry import using existing ingestion; verify offline service/API tests with import doubles and no automatic ingestion on read/push.
- [x] 4.2 Expose Topic MCP tools with scoped research reads, safe import and unchanged site-run agent allowlists; verify personal/agent/Topic credentials and cross-resource privacy offline.
- [x] 4.3 Implement bounded local PDF selected-page text/screenshots and native page/region citations with real MCP image blocks; verify local PDF fixtures/fake executables, bounds/errors and text-only compatibility offline.
- [x] 4.4 Document Topic/MCP/PDF endpoints and examples in docs/external-api.md and local dependencies/config in docs/tech-stack.md; verify examples match schemas and tool listings.

## 5. Hierarchical Topic tags

- [x] 5.1 Build latest source-aware node/ancestor associations and explicit-import paper bindings; verify stable identities on rename/move and isolation from manual tags/other Topics with offline tests.
- [x] 5.2 Add permission-scoped root badges and descendant-inclusive paper API filtering; verify shared access, revocation, compound filters (including manual-tag ownership) and historical-view isolation offline.
- [x] 5.3 Document generated-tag identity, current-index semantics and API fields in docs/frontend-architecture.md, docs/external-api.md and docs/tech-stack.md; verify descriptions against serializer/filter tests.

## 6. Topics frontend and reading cache

- [x] 6.1 Replace the original Research entry with the Topics AppPage/create flow, preserve legacy history/detail routes, and seed Topics from QA answers; verify route/navigation behavior and English labels.
- [x] 6.2 Build responsive Topic report/paper/history, sharing and own-token connection views with one-click S2 import; verify permission-specific controls, native citations and version coherence.
- [x] 6.3 Implement account/page-scoped last-displayed cache and simultaneous pure-addition animation; verify multi-update comparisons, first/all-new views, edits/deletions, repeated visits, historical browsing, storage failures and account/request races with offline tests.
- [x] 6.4 Integrate separate Topic root badges and directory filters in paper list/detail; verify badge navigation, URL persistence and manual-tag controls remain independent.
- [x] 6.5 Update docs/frontend-architecture.md for routes, reading/permission/cache behavior and docs/external-api.md/docs/tech-stack.md as needed; run the queued frontend build/type checks and inspect desktop/mobile behavior where tooling permits.

## 7. Integrated verification and deployment

- [x] 7.1 Review relevant test dependency paths, run proportionate offline integration/regression checks and strictly validate add-topics; verify no real model/S2/doc2x requests and inspect this change's final diff/file list.
- [x] 7.2 Create/check a current consistent database safety snapshot, verify local runtime dependencies and check active jobs, then deploy via bun run build:frontend and root-run paperland.service; verify local/public health, assets, authenticated Topic/MCP/Git behavior and legacy-history access without live external processing.
- [x] 7.3 Record deployment evidence and verification limits in this change, confirm task completion and ask for user review/archive authorization; leave add-topics active until authorized.

## 8. Legacy migration and editable Topic names

- [x] 8.1 Extend the repository model/reader for preserved URL citations, directory descriptions and verification metadata; verify offline conversion fixtures preserve original result content and entry ordering without fetching services.
- [x] 8.2 Add controlled server-side Git commits and a web rename API/editor; verify owner/editor/viewer permissions, stale-base rejection, only-topic.json diffs, stable root tags and historical names offline.
- [x] 8.3 Add additive legacy-session/step provenance and incomplete-import guards; verify migrations preserve existing data and pending Topics cannot leak via content, Git or tags.
- [x] 8.4 Implement a one-time dry-run/apply/verify migration CLI with consistent backup, persisted plans, source visibility and resumable commits; verify interrupted reruns and completed-Topic renames do not duplicate or overwrite results offline.
- [x] 8.5 Update all three architecture/API docs, deploy the new backend/frontend, and actually migrate the production Research results after a safety backup/quiescence; verify all 8 sessions/24 versions, source hashes, links and memberships, and repeat the migration to prove no duplicates.
- [x] 8.6 Run proportionate offline regression/type/build checks, inspect the actual rename/migrated content in the browser, strictly validate the updated change and record execution evidence; keep the change active for user review/archive authorization.

## 9. Reader layout and per-Topic general access

- [x] 9.1 Add additive per-Topic default access and centralized effective ACLs for explicit/default users across listing, content/history, paper badges/filters, credentials, counters, MCP and Git; verify offline policy changes, revocation, scope and push permissions.
- [x] 9.2 Add Private/Public and default Viewer/Editor choice to creation and owner Share settings; split Share and Connect entry points and retain individual grants, with offline API and browser permission checks.
- [x] 9.3 Build responsive left document navigation including Research questions/global References, central themed content card and right per-document reference subset; preserve imports/citations/history and verify desktop/phone, keyboard and light/dark behavior.
- [x] 9.4 Adapt last-displayed caching to independently rendered document/reference surfaces; verify hidden pages/drawers, file switches, accumulated updates, repeat visits and account/history races offline and in the browser.
- [x] 9.5 Update all three architecture/API docs, strictly validate the change, run focused offline/type/build checks, deploy frontend/backend and verify health, served assets and relevant behavior; record evidence and keep active for review.

## 10. Supplementary pages and global reference numbers

- [x] 10.1 Extend the Git contract/snapshot with bounded supplementary Markdown pages and validated numeric references frontmatter; verify safe nested Git trees, page links, history/rename preservation and invalid intermediate versions offline.
- [x] 10.2 Add stable reference-number persistence and coherent journal-backed allocation/validation across first appearances, reorder/removal/reappearance and concurrent pushes; verify numbering ignores publication year and cannot be reused/reassigned offline.
- [x] 10.3 Backfill existing reference registries from published histories without rewriting content, preserving legacy organization data; expose full or selected-document/metadata-only MCP reads, document bodies/subsets, authoritative numbers and next-number guidance through shared web/MCP services and verify idempotence/recovery offline.
- [x] 10.4 Document the approved file/frontmatter/catalog workflow, verify example clone/edit/push and reference navigation in the offline browser harness, and deploy with consistent schema backup and production read/asset checks.

## 11. Pages as first-class documents and agent workspace

- [x] 11.1 Introduce repository format v2 with pages/report.md home, nested pages/**/*.md, root AGENTS.md/README guidance, a strict shared references.json catalog and bounded auxiliary Git workspace files; validate title/fonticon/reference frontmatter, keep v1 history readable, and verify unsafe paths/modes remain rejected without executing auxiliary files offline.
- [x] 11.2 Generalize safe Git tree writes/deletions to preserve auxiliary paths/blobs/modes, forbid v2 downgrade, and provide an idempotent journal-backed current-layout migration with consistent backup and system attribution; verify moves preserve bodies, identities/numbers, ACLs and historical commits offline.
- [x] 11.3 Render a folder-derived left document tree with frontmatter titles/icons, centered report width capped near 680px and desktop three-column layout from normal desktop widths; make global All references a separate right drawer and verify narrow/desktop transitions and cache visibility offline/browser.
- [x] 11.4 Add clean first-class document URLs derived from paths, retain historical versions and legacy query links, decorate numeric reference links distinctly, and preserve last-displayed baselines across home moves; verify nested/relative navigation, unknown paths/icons and citations offline/browser.
- [x] 11.5 Deploy updated code and migrate current repositories without rewriting histories; maintain Topic3 through its own MCP/Git identity, separate Preview/Universal HexaShell references, move/group its RQ pages, keep the pre-split report as a current background page, clear assistant-planning entries from Discussion log, and verify production layout, URLs, drawer, workspace clone/push and audit.
- [x] 11.6 Update all three architecture/API docs and repository contract, run focused offline/type/queued-build checks and strict OpenSpec validation, record final evidence and leave the change active for user review.

## 12. Citation-first reading and folded references

- [x] 12.1 Replace the permanent page-reference rail with a default-collapsed in-page section; preserve the global right drawer, reset fold state by document/version/account and verify hidden reference baselines are not consumed.
- [x] 12.2 Reuse the existing Markdown citation-card presentation for numeric Topic citations, with hover/focus/tap opening, stable pointer-to-card movement, dismissal, safe positioning and one-click personal-library import; verify site/external/link, keyboard/mobile, failed/retried imports and stale-view cases offline/browser.
- [x] 12.3 Extend explicit Topic import/bindings to recognized arXiv-paper URL entries while keeping generic URLs external and source versions immutable; verify deduplication, ACLs, user-library isolation and no read/push/hover auto-ingestion offline.
- [x] 12.4 Update the three architecture/API docs, run focused offline/type/browser checks and strict validation, deploy through the root build queue and existing backend mechanism, verify public health/assets/relevant UI, and keep active for review.

## 13. Wider compact document navigation

- [x] 13.1 Widen desktop document navigation and tighten tree/guide spacing and indentation while retaining readable typography, selection and mobile navigation; update the three architecture/API docs and verify types, desktop/mobile geometry and keyboard toggling.
- [x] 13.2 Deploy through the queued root production build, verify public health/assets and relevant navigation, strictly validate the change and record evidence; leave active for review.

## Workflow follow-up

- After review and explicit archive authorization, run the generated archive workflow with spec sync, verify main/archived specs, bump the root package version, review exact affected paths and commit/push on main under AGENTS.md.
- Do not archive or commit concurrent migration, backup or Q&A layout changes as part of this change without their separate authorization.
