## Why

Semantic Scholar provides citation data and can resolve corpus_id to arxiv_id, enabling the dependency chain for papers added via corpus_id.

## What Changes

- Implement semantic_scholar_service as PaperBoundService (depends_on: [corpus_id], produces: [arxiv_id, citation_count, references])
- Fetch from Semantic Scholar API
- Register with ServiceRunner

## Capabilities

### New Capabilities
- `semantic-scholar-fetch`: Fetch paper data from Semantic Scholar API, resolve corpus_id to arxiv_id

### Modified Capabilities
(none)

## Impact
- **New files**: `packages/backend/src/services/semantic_scholar_service.ts`
- **Modified**: `packages/backend/src/index.ts` (register service)
