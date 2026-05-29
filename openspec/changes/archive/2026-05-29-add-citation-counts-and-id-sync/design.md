## Context

`semantic_scholar_service` is a paper-bound service declared with `depends_on: ['arxiv_id']`. The dependency scheduler (`service_runner.ts`) runs a paper-bound service when all of its `depends_on` keys are present, and skips it when **all** of its `produces` keys already exist. Today:

- **arXiv-added paper** → `arxiv_id` present → S2 service runs → resolves `corpus_id` + citation enrichment, and (because `arxiv_id` then chains to other services) fetches arxiv metadata/PDF.
- **Corpus-added paper** → only `corpus_id` present → the S2 service's `depends_on: ['arxiv_id']` is never satisfied → it is marked *blocked* and never runs. The paper keeps a single ID and has no citation data.

Two facts make the fix small:

1. `mapS2ToPaperFields()` is **already symmetric** — it back-fills `corpus_id` when missing *and* `arxiv_id` when missing. Only the **trigger** and the **queried id-expression** are arxiv-specific.
2. `fetchS2()` accepts any S2 id-expression; the API supports both `ARXIV:{id}` and `CORPUSID:{id}`. Only `fetchAndSaveEdges()` hardcodes the `ARXIV:` prefix.

The paper list (`PaperList.vue`) already receives parsed `metadata` per paper (the list endpoint runs `parsePaper`, and the UI already reads `metadata.s2_url`). `metadata.citation_count` is stored today; `reference_count` is not (only the capped `references` array, whose length undercounts).

Constraints: snake_case everywhere; S2 is rate-limited (~1 RPS, shared rate gate already in place); no schema migration desired.

## Goals / Non-Goals

**Goals:**
- Adding a paper by `arxiv_id` **or** `corpus_id` resolves the other ID and pulls the same S2 enrichment + citation graph.
- Store an accurate `reference_count` (S2 `referenceCount`) in metadata.
- Show citation count (cited-by) and reference count in the paper list, degrading to `–` when absent.

**Non-Goals:**
- No sorting/filtering of the list by citation metrics (display only).
- No new top-level DB columns or migration; counts stay in `metadata`.
- No change to how the citation-graph panel on the detail page works, beyond it being reachable for corpus-only papers.
- No synchronous (request-blocking) fetch at ingest — resolution stays asynchronous through the service graph (see Decisions).

## Decisions

### Decision 1: Make S2 a single bidirectional service with `depends_on: []`

Change `semantic_scholar_service` to `depends_on: []` and select the id-expression inside `execute()`:
`arxiv_id ? 'ARXIV:'+arxiv_id : corpus_id ? 'CORPUSID:'+corpus_id : <no-op>`. When neither ID is present (manual paper) it returns `{}` (no S2 call, marked done). `fetchAndSaveEdges()` takes the same id-expression instead of a hardcoded `ARXIV:`.

`produces` stays the enrichment set **without `arxiv_id`**: `['corpus_id','citation_count','influential_citation_count','reference_count','references']`.

**Why `depends_on: []` over a second "reverse" service:** the scheduler's `depends_on` is a pure AND with no OR. A second service keyed on `corpus_id` re-introduces double-execution: when a paper arrives with *both* IDs (e.g. conference ingest, dedup back-fill), both services satisfy their deps and both fire in the same batch → two S2 fetches for one paper. A single service with empty deps runs **exactly once** in every case (arxiv-only, corpus-only, both, neither) and is the minimal change. Alternatives rejected:
- *Two services with overlapping `produces`* — double-fires when both IDs present.
- *Two services where the reverse only `produces: ['arxiv_id']`* (pure ID resolver, enrichment via the arxiv path) — clean for arxiv-bearing papers, but **corpus-only papers that have no arXiv version** (common for conference/venue-only papers) would resolve no `arxiv_id` and therefore get **no enrichment at all**. Direct corpus enrichment is required.
- *Adding OR semantics to the scheduler* — larger blast radius than this change warrants.

**Why `arxiv_id` is deliberately NOT in `produces`:** keeping it out means the corpus-only flow chains cleanly. At plan time, arxiv-keyed services (arxiv metadata/PDF) stay *blocked* (no spurious launch). After the S2 service completes and writes the resolved `arxiv_id` to the row, the runner's post-completion re-trigger re-evaluates dependents against the **live** paper keys, sees `arxiv_id`, and fires arxiv metadata/PDF then — no spurious `failed` execution records. Putting `arxiv_id` in `produces` would make the planner schedule those services in a later batch up-front (launched concurrently before `arxiv_id` exists → they fail-then-retrigger), which is noisier.

**Cost:** a manual paper with no IDs now gets one no-op `done` execution row for the S2 service. Acceptable and cosmetic.

### Decision 2: Asynchronous resolution via the service graph (not request-synchronous)

The request says "synchronously fetch the other ID by default." We interpret *同步* as "automatically keep both IDs in sync," and implement it through the **existing async service graph** rather than blocking the HTTP add request on a rate-limited S2 call. This matches how arXiv→Corpus already works and avoids slow/timeout-prone add requests. The practical effect: just like arXiv papers today, citation counts for a freshly added corpus paper appear a moment later (on the next list refresh), not in the immediate add response.

### Decision 3: Add `referenceCount` to the S2 field set

Add `referenceCount` to `S2_FIELDS` and map it to `result.reference_count` in `mapS2ToPaperFields` (default `0`, like the other counts). The stored `references` array is a single capped page and undercounts; S2's `referenceCount` is the authoritative total. The frontend prefers `metadata.reference_count`, falling back to `metadata.references?.length` for papers enriched before this change (so old rows still show something until re-enriched).

### Decision 4: Display only — no schema change

Counts live in `metadata` and already arrive in the list response. The list gains one column rendering two numbers (citation count = cited-by, reference count = references), formatted with `toLocaleString()`, English labels per the request, `–` when undefined. No backend/API change for display.

## Risks / Trade-offs

- **Reversing documented behavior** ("Corpus-only paper is not enriched") → the `semantic-scholar-fetch` spec is updated via a delta; the service-declaration unit test (`depends_on === ['arxiv_id']`) is updated to assert the new `[]` + `reference_count` in `produces`.
- **Bulk corpus ingest triggers many S2 calls** (e.g. conference candidate lists) → already true for arXiv metadata-only papers; the shared S2 rate gate serializes all calls so the configured rate is respected. No new throttling logic; just more eligible papers.
- **Manual papers get a no-op S2 execution record** → cosmetic only; `execute()` returns early with no network call.
- **Old papers lack `reference_count`** → frontend falls back to `references.length`, then `–`; a re-run/back-fill of the S2 service repopulates it. Existing back-fill path (per the spec) covers re-enrichment.
- **Corpus-only paper with no arXiv version** → no `arxiv_id` resolved (expected); it still gets full citation enrichment directly from `CORPUSID:`. Edge endpoints use the `CORPUSID:` expression in that case.
