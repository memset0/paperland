# Tasks

## 1. Topics list

- [x] 1.1 Build `TopicCard` and rework `TopicsList.vue` with toolbar, Active/Archived tabs, skeletons and per-tab empty states; verify type checking and desktop/mobile light/dark screenshots.

## 2. Topic page

- [x] 2.1 Extract `useTopicDetail` and `useTopicReading`, and move the Topic components into `components/topics/`, without behavior change; verify type checking and the existing frontend unit tests.
- [x] 2.2 Add `Breadcrumb`, build `TopicHeader` (actions row, More actions menu, meta line, alerts) and `TopicRenameDialog`, and the borderless documentation layout; verify screenshots and that rename, archive, history version view and citations still work.
- [x] 2.3 Rebuild the Share, History and All references sheets with shadcn Select/Separator and show "via <app>" when present; verify screenshots and type checking.

## 3. Docs and deployment

- [x] 3.1 Update `docs/frontend-architecture.md`; build with `bun run build:frontend`; verify served assets and screenshots of production pages.
