## Context

`paper-reference-links` already ships a complete per-user CRUD feature: a `paper_reference_links` table (`title` NOT NULL, `url`, nullable `description`), authenticated `POST/PATCH/DELETE` + a degrade-to-empty `GET`, and a `ReferenceLinksSection.vue` form that collects title + url + optional description manually. Frontend auth state is available via `useAuthStore().isAuthenticated` (`user` from `/api/auth/me`).

This change reshapes the UX: the user supplies only a URL, the backend crawls the page to derive a description, and `title` stops being a required user field. No new external dependency is introduced — HTML `<title>` is extracted with a small regex, consistent with the codebase having no HTML parser installed.

## Goals / Non-Goals

**Goals:**
- One required input (URL); description auto-derived as `${document.title} (${hostname})`.
- Description is read-only (never user-typed/edited).
- Display falls back `title → description → url` so legacy rows (with titles) and new rows (description-only) both render well, and a failed crawl still shows the URL.
- Management controls (add/edit/delete) visible only to authenticated users.
- Crawl tunables in `config.yml`.

**Non-Goals:**
- No Open Graph / `og:title` / favicon / rich-preview extraction — plain `<title>` only.
- No background re-crawl or refresh job; description is captured at create time (and re-derived when the URL is edited).
- No SSRF allow/deny-list beyond requiring auth + http(s) scheme + timeout/size caps (personal-use tool, behind login).
- No change to ownership/privacy semantics or list ordering.

## Decisions

**1. Server-side crawl via a dedicated preview endpoint, not client-side fetch.**
`GET /api/reference-links/preview?url=<encoded>` (preHandler `requireUser`) validates the URL (reusing the existing `normalizeUrl` http(s) check), fetches it with `AbortSignal.timeout`, reads at most `max_bytes`, regex-extracts the first `<title>…</title>`, decodes a few basic HTML entities (`&amp; &lt; &gt; &quot; &#39;`), collapses whitespace, and returns `{ data: { title, hostname, description } }`.
- `description = title ? \`${title} (${hostname})\` : hostname` when the fetch succeeds.
- On any failure (timeout, non-2xx, network error, no `<title>`): return `{ data: { title: null, hostname, description: null } }` with HTTP 200 — a failed crawl is not a client error; the frontend simply saves the link without a description and display falls back to the URL.
- *Why server-side:* browsers can't fetch arbitrary cross-origin pages (CORS), and keeping the crawl behind `requireUser` prevents the endpoint from being an open fetch proxy.
- *Alternative rejected:* storing the raw page title separately from the composed description — unnecessary; the composed string is what we display.

**2. `title` becomes nullable; only `url` is required.**
`db/schema.ts`: `title: text('title')` (drop `.notNull()`), generate a Drizzle migration. `PaperReferenceLink.title: string | null` in shared types. Create no longer requires title; `normalizeTitle` is reused only when a title is actually provided. `description` continues to validate length (`DESCRIPTION_MAX`) but is now produced by the preview flow rather than typed.
- *Alternative rejected:* keep `title` NOT NULL and store the description string into `title` for new rows — this collapses the fallback semantics and corrupts the meaning of the column. Nullable title is cleaner and keeps the `title → description → url` chain meaningful.

**3. Frontend: url + optional-title form with live description preview.**
The add form shows a required URL `Input` and an **optional** title `Input`. On a debounced change (and on blur/enter) of a valid-looking URL, call `referenceLinksApi.preview(url)`; show the returned `description` as read-only secondary text with a small spinner while loading. Save sends `{ url, title, description }` where `title` is the optional user value (`null` when blank) and `description` is the auto-derived preview (never hand-typed). Editing reuses the same form: changing the URL re-runs preview; the description stays read-only; the title is pre-filled and editable. The whole add/edit/delete affordance set is wrapped in `v-if="auth.isAuthenticated"`.
- Display text per link = `link.title || link.description || link.url`.
- *Correction (post-apply):* an earlier cut removed the title input entirely, which broke the `title → description → url` intent for sites that can't be crawled (e.g. zhihu 403). The optional title input is retained so the user can always name a link the crawler can't describe.

**4. Crawl config in `config.yml`.**
Add a `reference_links` block: `{ fetch_timeout_ms: 8000, max_bytes: 524288, user_agent: <browser-like UA> }`. A browser-like User-Agent is used because many sites 403 obvious bot agents; a few (zhihu) still block server-side fetches entirely and simply yield no description. Per the project's Zod convention, the nested block uses an explicit `.default({ … all fields … })` (not `.default({})`) so omitting the key still yields the real defaults.

## Risks / Trade-offs

- **[SSRF / internal-network probing]** An authenticated user could point the crawler at `http://localhost`/internal IPs. → Mitigated by requiring auth (trusted, logged-in users only) + http(s)-only + short timeout + byte cap. A deny-list is out of scope for this personal tool; noted as a future hardening.
- **[Pages without a usable `<title>` or that block bots]** Description comes back null. → Graceful: link still saves on URL alone (or the user's optional title), and displays the fallback; the user is not blocked. Crawl robustness was improved post-apply — browser-like headers incl. `accept-language`, charset detection (Content-Type + `<meta charset>`, so GBK/Big5 Chinese pages decode correctly), and `og:title`/`twitter:title` fallback when `<title>` is empty.
- **[Hard login walls / anti-bot — e.g. zhihu, some Cloudflare sites]** These return 403 or a "请登录" page to *every* server-side client; even browser-rendering services (Jina Reader, microlink) only get the login wall or the URL slug. So their titles are fundamentally un-fetchable server-side without the user's own login cookies. → Out of scope to defeat; the optional manual **title** input is the intended path for such links, and the UI tells the user so ("无法自动获取描述（站点可能禁止抓取），可手动填写标题").
- **[Stale description after URL edit]** Editing the URL re-derives the description; editing nothing leaves the captured description as-is (intended — no background refresh).
- **[Legacy rows keep their typed title]** Intentional — the fallback chain shows their title; they are not retro-rewritten.
- **[Migration]** `title` NOT NULL → nullable is a widening change; existing non-null titles remain valid, so it is backward-compatible with no data backfill. Rollback = revert the migration (no data loss since no column is dropped).
- **[`requireUser` does not halt the GET lifecycle in this Bun+Fastify runtime]** Empirically, `requireUser` (which `return`s a sent 401 reply) halts the lifecycle for POST but **not** for GET — an anonymous GET still runs the route handler, which would crawl on the caller's behalf and double-send. → The preview handler starts with `if (!request.user) return reply` (returns the already-sent 401 so Fastify treats the response as handled and skips the crawl). The shared guard is left unchanged (app-wide fix is out of scope); other GET routes that read `request.user?.id` already tolerate this by degrading to empty results.

## Migration Plan

1. Edit `db/schema.ts` to make `title` nullable; run `bunx drizzle-kit generate` from `packages/backend` to emit the migration; the runner applies it on next backend start.
2. Ship backend (preview endpoint + relaxed validation + config) and frontend together. The change is additive/compatible: old links keep working; the API still accepts a `title` if sent.
3. Rollback: revert the migration + code; nullable→NOT NULL would only fail if a null-title row exists, so rollback should drain new-style rows first (acceptable for a personal deployment).
