## Why

The current "参考链接" feature forces the user to hand-type a title and an optional description for every link, which is tedious and produces inconsistent, low-quality labels. We can do better by auto-deriving a human-readable description from the linked page itself, requiring only the URL, and making clearer that link management is a logged-in-only action.

## What Changes

- **Only the URL is required.** The add form keeps a required URL input plus an **optional** `title` input; `title` is no longer required. **BREAKING** (API): `POST /api/papers/:id/reference-links` no longer requires `title`.
- **Auto-fetched description.** After the user enters a URL, the frontend asks the backend to crawl the page and derive a description of the form `${document.title} (${hostname})` (e.g. `Build software better, together (github.com)`). The description is filled automatically and is **no longer user-editable** (the manual description input is removed). For sites that block server-side crawls (e.g. zhihu → 403), the description comes back empty and the user can name the link via the optional title instead.
- **New backend endpoint** `GET /api/reference-links/preview?url=…` (authenticated): server-side fetches the URL, parses the HTML `<title>`, and returns the derived description + hostname. Server-side fetch avoids browser CORS and keeps crawling behind auth.
- **Display fallback chain.** A link renders as `title → description → url`: show `title` if present (legacy rows), else the auto `description`, else the raw `url`. Under the new flow `description` is always present unless the page could not be opened.
- **Login-gated management UI.** The add / edit / delete controls in the 参考链接 section are shown only to authenticated users (mutations already require auth on the backend; this hides the controls in the UI too).
- **Schema:** `paper_reference_links.title` becomes nullable (was `NOT NULL`); a Drizzle migration is generated.
- **Config:** crawl tunables (timeout, max response bytes, user-agent) live in `config.yml`, not hardcoded.

## Capabilities

### New Capabilities
<!-- none — this extends the existing reference-links capability -->

### Modified Capabilities
- `paper-reference-links`: `title` becomes optional and is no longer user-entered; description is auto-derived server-side from the page `<title>` plus hostname and is read-only; only `url` is required; a new authenticated preview/metadata-fetch endpoint is added; display falls back `title → description → url`; the management UI (add/edit/delete) is shown only to authenticated users.

## Impact

- **Backend:** `packages/backend/src/api/reference_links.ts` (relax title requirement on create/update, add preview endpoint, HTML `<title>` parsing helper), `db/schema.ts` (title nullable) + new migration, `config.ts` + `config.yml` (crawl tunables).
- **Shared:** `packages/shared/src/types.ts` — `PaperReferenceLink.title: string | null`; add a preview-response type.
- **Frontend:** `components/ReferenceLinksSection.vue` (single-URL form, auto-load description, read-only description, auth-gated controls, fallback display), `api/client.ts` (`preview` method; optional `title` in payloads).
- **Docs:** `docs/frontend-architecture.md`, `docs/external-api.md` as applicable.
- **Tests:** `packages/backend/src/api/reference_links.test.ts` — title-optional create, preview endpoint auth + URL validation (no real network in tests).
