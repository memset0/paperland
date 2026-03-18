## Why

Papers need their PDF content parsed to plain text for Q&A. The pdf_parse_service converts downloaded PDFs to text, storing it in contents.pdf_parsed.

## What Changes

- Implement pdf_parse_service as PaperBoundService (depends_on: [pdf_path], produces: [contents.pdf_parsed])
- Support two methods: Node.js (pdf-parse library) or Python (PyMuPDF), configurable in config.yml
- Register with ServiceRunner

## Capabilities

### New Capabilities
- `pdf-parse`: Parse PDF files to plain text, configurable between Node.js and Python backends

### Modified Capabilities
(none)

## Impact
- **New files**: `packages/backend/src/services/pdf_parse_service.ts`
- **New dependency**: `pdf-parse` npm package
- **Modified**: `packages/backend/src/index.ts`, `packages/backend/package.json`
