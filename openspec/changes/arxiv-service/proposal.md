## Why

Arxiv is the primary data source for Paperland. We need to fetch paper metadata (title, authors, abstract, categories) and download PDFs from arxiv.org. This is the first concrete paper-bound service built on the service framework.

## What Changes

- Implement arxiv_service as a PaperBoundService (depends_on: [arxiv_id], produces: [pdf_path, arxiv_categories])
- Fetch metadata from arxiv API (Atom XML feed)
- Download PDF to data/pdfs/ directory
- Auto-fill title, abstract, authors from arxiv metadata
- Register with ServiceRunner at startup

## Capabilities

### New Capabilities
- `arxiv-fetch`: Fetch paper metadata and PDF from arxiv.org via the arxiv API, registered as a paper-bound service

### Modified Capabilities

(none)

## Impact

- **New files**: `packages/backend/src/services/arxiv_service.ts`
- **Modified**: `packages/backend/src/index.ts` (register service)
- **New directory**: `data/pdfs/` for downloaded PDFs
