## 1. Shared pieces

- [x] 1.1 `composables/useNarrowLayout.ts` and `components/MobileBottomBar.vue` (sections + actions, badge/busy, safe area, slide-in animation, `--bottom-bar-h`)

## 2. Paper detail

- [x] 2.1 Narrow non-embed layout split into Info / Read / Q&A (`v-show`, Read mounted lazily) with the bar and Ask action; header launcher hidden
- [x] 2.2 Deep links switch sections (PDF target, public note, `?view=note` → Read; Q&A reveal → Q&A)
- [x] 2.3 `PaperActionLauncher`: no FAB (bar replaces it)

## 3. Deep Research detail

- [x] 3.1 Wide: input on top, steps newest first
- [x] 3.3 Round duration in the timeline; Q&A list headers wrap on narrow screens
- [x] 3.2 Narrow: Instruct / Report / Papers sections with the bar; Instruct timeline oldest → newest, fixed input above the bar, scroll to newest; running/queued indicators

## 4. Docs, verification, deploy

- [x] 4.1 `docs/frontend-architecture.md`
- [ ] 4.2 vue-tsc, verification build, check at phone and desktop widths (headless screenshots)
- [ ] 4.3 After archive: production build `bun run build:frontend`
