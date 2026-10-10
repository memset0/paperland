---
name: s2-literature-search
description: Find papers and their exact Semantic Scholar paperIds, verify ids, chase citations, and read papers already in the Paperland library, using the paperland MCP tools. Use whenever a task needs S2 ids (s2_id / #cite links), a literature survey, or a paper's full text.
---

# Literature search with Semantic Scholar and Paperland

The `paperland` MCP server gives you read-only tools. S2 tools go through one shared Semantic
Scholar key limited to about **one request per second** for the whole site, so every call costs
real time. Plan calls; never loop over hundreds of papers one by one.

## Getting a paper's S2 paperId (never guess)

1. **Known title → `s2_match(title)`.** This is the reliable way to get a paperId. Check that the
   returned title, year, and first author agree with the paper you mean; a different version or a
   same-named paper is a mismatch. `match: null` means S2 has no confident match.
2. **No exact title → `s2_search(query, year?)`.** Use a specific query (distinctive title words,
   method name + author). Pick the result whose title, year, and authors agree.
3. **Ids you already have → `s2_papers(ids)`** verifies up to a few hundred ids in one call (40-hex
   paperId, `CorpusId:<n>`, or a semanticscholar.org URL) and is mostly served from the local cache.
   Use it to confirm ids from the current list or from web pages instead of re-searching.
4. If nothing matches, the paper is probably too new or not indexed: cite it as a link item
   (`url` + BibTeX-style `citation`) instead of inventing an id.

Use the 40-character `s2_paper_id` from the tool result as the paper's `s2_id` and in
`[title](#cite:<s2_paper_id>)` links.

## Library papers first

- `search_papers(query)` searches the Paperland library. Results (and S2 results) carry
  `in_library` / `link` = `paperland://paper/<id>` when the paper is in the library.
- For library papers, read the source instead of guessing: `read_paper(paper_id, outline=true)`
  gives the section outline with character offsets, then `read_paper(paper_id, offset=…)` reads a
  page; follow `next_offset` only as far as you need.
- `get_paper_qa(paper_id)` returns existing Q&A answers about a paper — often a quick summary.

## Citation chasing

- `s2_references(id)` — what a paper builds on; `s2_citations(id)` — later work that cites it.
  Both return one page (`limit` ≤ 100, `next_offset` to continue). Prefer `is_influential` results
  and recent, highly cited papers; one or two pages are usually enough.
- `id` accepts a paperId or an expression such as `CorpusId:123` or `ARXIV:2106.15928`.

## Anything else: `s2_get`

`s2_get(path, params)` performs a GET on the Graph API, e.g.
- `/graph/v1/author/search` with `{"query": "Tri Dao", "fields": "name,paperCount,hIndex"}`
- `/graph/v1/author/{authorId}/papers` with `{"fields": "title,year,citationCount", "limit": 50}`
- `/graph/v1/paper/{id}` with `{"fields": "title,year,venue,externalIds,tldr"}`

Only `/graph/v1/` paths are allowed; put query parameters in `params`. Large responses are truncated.

## Budget

- A typical round should need tens of S2 calls, not hundreds. Batch verification with `s2_papers`.
- Do not repeat a search that already answered the question; reuse ids you have found.
- Combine with web search for discovery (blogs, project pages, proceedings), then come back to
  `s2_match` to get the paperId.
