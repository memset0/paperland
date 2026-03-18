## Context
PDFs downloaded by arxiv_service need text extraction for Q&A context.

## Goals / Non-Goals
**Goals:** Extract text from PDF, store in contents.pdf_parsed
**Non-Goals:** OCR, table extraction, figure parsing

## Decisions
### 1. Dual backend support
Config `services.pdf_parse.method`: "nodejs" uses `pdf-parse` npm package, "python" spawns `scripts/pdf_parser.py`. Default: nodejs.

## Risks / Trade-offs
- **[Risk] pdf-parse quality varies** → Acceptable for text-heavy papers. Python backend available as fallback.
