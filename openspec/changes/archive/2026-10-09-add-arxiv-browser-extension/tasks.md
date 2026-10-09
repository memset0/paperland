## 1. Backend

- [x] 1.1 Add `normalizeArxivId` in `packages/backend/src/utils/arxiv_id.ts` with unit tests covering new-style, old-style, `arXiv:` prefix, version suffix and garbage input; verify with `bun test src/utils/arxiv_id.test.ts`
- [x] 1.2 Add nullable `open_token` column to `users` in `db/schema.ts` and generate the Drizzle migration; verify the migration file exists and applies on backend startup
- [x] 1.3 Add `GET /api/auth/open-token` (lazy generate) and `POST /api/auth/open-token/regenerate` (both `requireUser`) in `api/auth.ts`; verify with a backend test against an in-memory DB
- [x] 1.4 Add `POST /api/papers/open-arxiv` (`requireUser`, timing-safe token check → 403 `INVALID_OPEN_TOKEN`, 422 on invalid id, `ingestPaper` → `{ paper_id, arxiv_id, created }`); verify with backend tests for create / existing / wrong token / anonymous / invalid id

## 2. Frontend

- [x] 2.1 Add API client `quickOpenApi` (`getToken`, `regenerateToken`, `openArxiv`) and verify type-check passes
- [x] 2.2 Add `views/OpenArxiv.vue` and route `/open/arxiv/:arxiv_id(.*)` (no auth meta; view opens login dialog and continues after login; `router.replace` to detail; error state with link back); verify via `vue-tsc`/build and a manual run against the dev server
- [x] 2.3 Add "Browser Extension" section to `AccountDialog.vue` (site URL + token with copy, regenerate); verify build passes and the section renders
- [x] 2.4 Let the production SPA fallback in `frontend_hosting.ts` serve `/open/...` paths whose last segment looks like an extension; verify with `bun test src/frontend_hosting.test.ts`

## 3. Browser extension

- [x] 3.1 Create `packages/browser-extension/` with `manifest.json` (MV3, activeTab/scripting/storage, Chromium service worker + Firefox scripts, Alt+Shift+P command, icons) and `package.json` with a test script; verify manifest is valid JSON and the workspace installs
- [x] 3.2 Implement `src/arxiv.js` (`extractArxivIdFromUrl`, `normalizeArxivId`, `buildOpenUrl`) with unit tests for arxiv abs/pdf/html, HF, alphaXiv, old-style and unrelated URLs; verify with `bun test`
- [x] 3.3 Implement `src/background.js` (click/shortcut → URL id → meta fallback → open tab next to current; "?" badge on miss; options page when unconfigured) and `src/options.html/.js`; verify by loading the unpacked extension (or a syntax check with `bun build` when no browser is available)

## 4. Docs and verification

- [x] 4.1 Update `docs/frontend-architecture.md`, `docs/external-api.md`, `docs/tech-stack.md` and add `docs/browser-extension.md` (install + usage); verify docs mention the new route, endpoints and package
- [x] 4.2 End-to-end check (isolated scratch server with in-memory DB + built frontend + Playwright Chromium with the extension loaded, so the shared running dev stack is not restarted): open `/open/arxiv/<id>?token=<token>` for an existing and a new id, confirm redirect to the detail page and that a wrong token is rejected
