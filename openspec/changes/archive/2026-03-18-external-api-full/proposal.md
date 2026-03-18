## Why
External API needed for Zotero plugin and third-party integrations. Need full CRUD, /papers/full endpoint, tag sync, and batch operations.

## What Changes
- POST /external-api/v1/papers — create with auto-trigger
- GET /external-api/v1/papers/:id — get paper
- GET /external-api/v1/papers?arxiv_id= — search by external ID
- GET /external-api/v1/papers/full — full paper info with QA, services, auto_create, auto_template_qa, exclude
- POST /external-api/v1/papers/batch — batch create
- PUT/PATCH /external-api/v1/papers/:id/tags — tag sync

## Capabilities
### New Capabilities
- `external-api-endpoints`: Complete external API with paper CRUD, full info, batch, and tag sync

### Modified Capabilities
(none)

## Impact
- **New files**: packages/backend/src/external-api/papers.ts, packages/backend/src/external-api/tags.ts
- **Modified**: packages/backend/src/index.ts
