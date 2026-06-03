## 1. Schema & shared types

- [x] 1.1 Make `paper_reference_links.title` nullable in `packages/backend/src/db/schema.ts` (drop `.notNull()`)
- [x] 1.2 Run `bunx drizzle-kit generate` from `packages/backend` to emit the migration; verify `_journal.json` + new SQL are created
- [x] 1.3 Change `PaperReferenceLink.title` to `string | null` in `packages/shared/src/types.ts`; add a `ReferenceLinkPreview` type (`{ title: string | null; hostname: string; description: string | null }`)

## 2. Config

- [x] 2.1 Add a `reference_links` block to the Zod config schema in `packages/backend/src/config.ts` with `fetch_timeout_ms` (8000), `max_bytes` (524288), `user_agent` ('paperland-link-preview/1.0'), using an explicit `.default({ …all fields… })` (not `.default({})`)
- [x] 2.2 Add the matching `reference_links` block to `config.yml` (and any committed example config) with the same values

## 3. Backend: preview endpoint & relaxed validation

- [x] 3.1 In `packages/backend/src/api/reference_links.ts`, add an HTML `<title>` extraction helper: fetch with `AbortSignal.timeout(fetch_timeout_ms)` + user-agent header, cap reading at `max_bytes`, regex-extract first `<title>…</title>`, decode basic entities (`&amp; &lt; &gt; &quot; &#39;`), collapse whitespace, trim
- [x] 3.2 Add `GET /api/reference-links/preview` (preHandler `requireUser`): validate `url` via `normalizeUrl` (400 if invalid), crawl, return `200 { data: { title, hostname, description } }` where `description = title ? \`${title} (${hostname})\` : hostname`; on timeout/error/non-2xx/no-title return `200 { data: { title: null, hostname, description: null } }`
- [x] 3.3 Relax `POST /api/papers/:id/reference-links`: require only a valid `url`; accept optional `title` (validate length only when non-empty, store `null` when absent/empty); keep description length validation
- [x] 3.4 Relax `PATCH /api/reference-links/:id`: when `title` is provided, allow clearing to `null`; keep url/description validation; still 404 for non-owner
- [x] 3.5 Register order check — endpoint is under `referenceLinksRoutes` (already registered in `index.ts`); ensure `/api/reference-links/preview` does not collide with `/api/reference-links/:id` (distinct method/path: GET vs PATCH/DELETE)

## 4. Frontend: client API

- [x] 4.1 In `packages/frontend/src/api/client.ts`, add `referenceLinksApi.preview(url: string): Promise<{ data: ReferenceLinkPreview }>` (GET with encoded `url` query, `credentials: 'same-origin'`)
- [x] 4.2 Make `title` optional in the `create`/`update` payload types

## 5. Frontend: ReferenceLinksSection.vue

- [x] 5.1 Replace the three-field form with a single required URL `Input`; remove the title and description inputs
- [x] 5.2 On debounced URL change (and blur/enter), if the URL looks valid call `preview()`; show a spinner while loading and render the returned `description` as read-only secondary text
- [x] 5.3 On save, send `{ url, description }` (omit title) for create; for edit, send `{ url, description }` and re-run preview when the URL changes
- [x] 5.4 Render each link's label via the fallback chain `link.title || link.description || link.url`
- [x] 5.5 Gate the add / edit / delete controls behind `useAuthStore().isAuthenticated` (hide affordances for anonymous viewers)
- [x] 5.6 Update validation/error copy: only the URL is required (remove the "请填写标题" path)

## 6. Tests & docs

- [x] 6.1 In `packages/backend/src/api/reference_links.test.ts`, add/adjust: create succeeds with url only (null title); preview returns 401 unauthenticated and 400 for non-http(s) url (no real network — assert validation paths, avoid live fetch)
- [x] 6.2 Run the backend test file and confirm it passes
- [x] 6.3 Update `docs/frontend-architecture.md` (and `docs/external-api.md` if applicable) to describe the URL-only flow, auto-description, preview endpoint, and auth-gated controls
- [x] 6.4 Fold any post-apply tweaks back into this change's proposal/specs/tasks per the project workflow
