## 1. Backend

- [x] 1.1 Add `feature_views` table to `db/schema.ts` and generate the Drizzle migration
- [x] 1.3 Add the feature registry `src/features.ts` with the six initial entries
- [x] 1.4 Add `api/features.ts` (`GET /api/features`, `POST /api/features/seen`) and register it in `index.ts`
- [x] 1.5 Add shared types `FeatureItem` / `FeatureListResponse`
- [x] 1.6 Add `api/features.test.ts` (per-user seen, idempotence, unknown key 400, anonymous 401, ordering) and run it

## 2. Frontend

- [x] 2.1 Add the six SVG illustrations under `packages/frontend/public/features/`
- [x] 2.2 Add `featuresApi` to `api/client.ts` and the `features` Pinia store
- [x] 2.3 Sidebar Home red count in `App.vue` (shared `badgeCount`), store loads per signed-in user; no push dialog
- [x] 2.4 Add `components/home/FeatureList.vue` (header red count; cards with red dot, click marks seen) and insert it into `views/HomePage.vue` after the usage dashboard
- [x] 2.5 Verify with `bun run build:frontend --out-dir <scratch>`

## 3. Docs and validation

- [x] 3.1 Update `docs/frontend-architecture.md` (incl. how to add a feature) and `docs/tech-stack.md`; `docs/external-api.md` unchanged (the features API is internal `/api`, not External API)
- [x] 3.2 `npx openspec validate add-feature-announcements --strict`
