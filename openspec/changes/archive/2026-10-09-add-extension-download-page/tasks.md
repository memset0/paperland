## 1. Backend

- [x] 1.1 Add `api/extension.ts` with a dependency-free STORE zip writer and `GET /api/extension/download` (requireUser, base_url validation, runtime files + `src/preset.json`); register it in `index.ts`; verify with a backend test that unzips the response (`unzip -l` / parse) and checks files, preset contents, 401 and 422

## 2. Extension

- [x] 2.1 Add preset fallback to `src/settings.js` (storage first, `preset.json` second, errors → empty) and bump `manifest.json` version to 0.2.0; verify with a bun unit test of the merge logic and by loading a downloaded zip in Playwright Chromium (options page pre-filled)

## 3. Frontend

- [x] 3.1 Add `views/ExtensionPage.vue` (AppPage; download, install steps, site URL/token copy + regenerate, supported sites), route `/extension` with `meta.title`/`meta.icon`/`requiresAuth`, sidebar entry in `App.vue`, client `extensionApi.downloadUrl`; verify `vue-tsc` and build pass and a Playwright screenshot shows the page

## 4. Docs and verification

- [x] 4.1 Update `docs/frontend-architecture.md`, `docs/external-api.md`, `docs/tech-stack.md`, `docs/browser-extension.md`; verify the docs describe the page, endpoint and preset
- [x] 4.2 Rebuild the frontend and restart `paperland.service`; confirm the live site serves `/extension` and the download endpoint (401 anonymous). The logged-in download → unzip → load in Chromium → prefilled options flow is verified end-to-end on an isolated scratch server running the same code (no credentials are used against the live site)
