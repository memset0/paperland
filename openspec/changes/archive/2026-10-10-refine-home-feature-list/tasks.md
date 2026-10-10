## 1. Registry

- [x] 1.1 Add the `deep-research` entry (2026-10-09) to `packages/backend/src/features.ts` and `packages/frontend/public/features/deep-research.svg`
- [x] 1.2 Update `packages/backend/src/api/features.test.ts` registry assertions and run it

## 2. Home section

- [x] 2.1 `FeatureList.vue`: list only unseen features (fade out on click), "No new features" empty state, "All features" button in the header
- [x] 2.2 `FeatureHistoryDialog.vue`: all features newest first, unseen dots clickable, opening does not mark seen

## 3. Docs and verification

- [x] 3.1 Update `docs/frontend-architecture.md` and `docs/tech-stack.md` (`docs/external-api.md` unaffected: internal API only)
- [x] 3.2 Verification build via `bun run build:frontend --out-dir <scratch>`; check Home and the dialog in the running app
- [x] 3.3 `npx openspec validate refine-home-feature-list --strict`
