## Context

Arxiv provides a free API at `http://export.arxiv.org/api/query?id_list=XXXX.XXXXX` returning Atom XML with paper metadata. PDFs are at `https://arxiv.org/pdf/XXXX.XXXXX.pdf`.

## Goals / Non-Goals

**Goals:**
- Fetch title, authors, abstract, categories from arxiv API
- Download PDF to local storage
- Register as paper-bound service with dependency graph

**Non-Goals:**
- Parsing PDF content (separate pdf-parse service)
- Batch fetching multiple papers in one API call

## Decisions

### 1. Use native fetch + XML parsing
Use Bun's built-in `fetch()` for HTTP requests. Parse the Atom XML response with a simple regex/string approach — the arxiv API response is well-structured and we only need a few fields. No XML parser dependency needed.

### 2. PDF storage in data/pdfs/
Store PDFs as `data/pdfs/{arxiv_id}.pdf` (replacing dots and slashes in the ID with underscores). The path is stored in the paper's `pdf_path` field.

## Risks / Trade-offs

- **[Risk] Arxiv rate limiting** → Mitigated by service framework's rate_limit_interval (3s configured). Arxiv generally allows ~1 request per 3 seconds.
