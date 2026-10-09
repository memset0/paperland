## Context

`GET /api/papers` in `packages/backend/src/api/papers.ts` builds `select * from papers where … order by …`, calls `.all()`, then slices the page in JS and runs `parsePaper` (which JSON-parses `contents` and `metadata`). Measured on a production copy (user with 125 papers): Mine page 1 = 4.51 MB / ~380–570 ms server time; All page 1 = 5.21 MB / ~530–1130 ms, before network transfer and browser JSON parsing. The list UI uses only id, identifiers, title, authors, link, listed/listable, tags, in_library, timestamps and three metadata values. Full text is used only by `PaperFullTextCopy`, which reads the detail response.

## Goals / Non-Goals

**Goals:** small list payload (tens of KB per page); no full-text reads for the list; same filters/sort/scope/pagination semantics.

**Non-Goals:** changing the detail endpoint or the external API; adding a `fields=` parameter; caching.

## Decisions

- **Explicit column selection** for the list: every `papers` column except `contents`. `metadata` is still read (it is small relative to `contents` and needed for the counts) and slimmed in JS via `slimListMetadata()` to `citation_count`, `reference_count` (fallback `references.length`), `s2_url`. Alternative — SQL `json_extract` — rejected: more brittle against malformed JSON and harder to read; the remaining metadata is only ~15 KB/paper for 20 rows.
- **SQL pagination**: the same `where` is used for a `count(*)` query and for the page query with `.limit(pageSize).offset((page-1)*pageSize)`. Order keeps the existing sort column; add `id` as a tiebreaker so pages are stable when timestamps tie.
- **Omit, don't null, `contents`** in list items; `Paper.contents` becomes optional in the shared type so the list type is honest. Existing readers already use optional chaining.

## Risks / Trade-offs

- A client relying on list items' `contents`/full `metadata` would break → only the web frontend calls this endpoint (Zotero/extension use the external API); verified by search.
- `page_size` is unbounded today; unchanged here.
