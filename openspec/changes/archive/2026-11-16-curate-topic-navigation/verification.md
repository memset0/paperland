# Verification

## Contract and offline checks

- 45 distinct focused offline tests passed across format, schema, layout, reference registry, MCP/API, Git transport, schema migration and frontend navigation. Fixtures use local SQLite/Git, injected data and fake provider boundaries; no real model, S2 or other provider was called by these tests.
- The canonical MCP examples round-trip through the parser. Tests cover unknown/ambiguous versions, page completeness/duplicates, unsafe paths, malformed/deep/cyclic YAML, metadata source, schema scope/counting, preserved legacy reads, canonical intermediate push rejection and downgrade rejection.
- Schema migration fixtures preserve exact report/page blobs, custom AGENTS.md, binary workspace, reserved reference identities/numbers, old commits and system audit. Injected interruption recovers; read-only CLI dry-run, selected IDs, missing ID errors, consistent backup, verify and repeat apply pass. A pre-existing legacy reports.yml is readable but blocks migration rather than being overwritten.
- Frontend vue-tsc passed using the installed workspace binary. Backend full tsc retains 87 pre-existing errors outside Topic/shared Topic modules; no Topic errors were reported. git diff --check and strict OpenSpec validation passed.

## Deployment and migration

- The previous completed add-topics baseline was synced across 12 capabilities, archived at 2026-11-10-add-topics, committed as 0ea6007 and pushed to main. Root app version is 2.3.10; this active follow-up does not bump it.
- Root queued production build succeeded in31.64s. Backend was stopped with no active QA, Research or service work, seven selected Topics were upgraded through the journal-backed maintenance CLI, then paperland.service was started. WorkingDirectory remains /root/git/paperland. No packages/backend/data directory exists.
- Disposable production-copy rehearsal upgraded all8, then verify/repeat skipped8. Every pre-existing blob except metadata matched. Owner/default access were preserved.
- Restricted safety/rehearsal root: /root/paperland-topic-schema-2026-11-10T21-56-01-215Z. Consistent production backup: production-backup/before-schema-migration.db. Do not delete backups as part of unrelated cleanup.
- Topic3 was excluded from system migration. Its actual user-bound Topic token called get_topic_schema/get_topic, pulled the repository, and pushed only topic.json, reports.yml and a targeted AGENTS.md update. Commit d2a2aadbbd5271cd262b9b30fcb232250bd5d22c is audited as actual Paperland user1, mem. It retains14 report pages,98 current references and the complete original report. No research prose was changed.
- Final CLI verify reports all8 canonical repositories. Comparing production against the consistent backup confirms all report/catalog/workspace blobs unchanged (only topic.json, and Topic3's authorized guide update, differ), unchanged reference reservations, owners/default access and individual grants. SQLite integrity and foreign-key checks pass.
- Authenticated public MCP reads confirm schema v1 status, current contract, real pusher and legacy format2 history at7d18de4 with14 pages plus guide.
- Public health is ok; HTML and entry JS/CSS match packages/frontend/dist byte-for-byte. paperland.service is active.

## Browser checks

- Offline agent-browser checks verify one overview row, separate label/chevron actions, Enter/Space expansion, clean page routes, selected ancestors and a375px phone drawer without horizontal overflow. Screenshots /tmp/topic-schema-nav-desktop.png and /tmp/topic-schema-nav-mobile.png; evidence /tmp/topic-schema-nav-browser.json.
- Authenticated production Topic3 was checked at1440x1000 and375x812. Desktop sidebar280px, overview count1; Research questions contains RQ0-RQ7, Related work expands to leaderboard/competitors, Discussion log keeps its clean route and empty user-provided-conversation policy. Mobile tree is compact and has no horizontal overflow. Browser errors are empty. Evidence /tmp/topic-schema-production-browser.json and screenshots /tmp/topic-schema-production-desktop.png, /tmp/topic-schema-production-mobile.png.
- Browser processes and temporary copies of login state were cleaned; real user session and long-term Topic maintenance credentials remain untouched.

## Review state

All6 tasks complete and deployed. This independent change remains active pending user review and its own archive authorization. The unrelated polish-qa-feed-layout change and its two implementation files are untouched.
