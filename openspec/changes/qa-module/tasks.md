## 1. Templates

- [ ] 1.1 Create templates/abstract.md, method.md, experiment.md with example prompts
- [ ] 1.2 Create packages/backend/src/services/template_loader.ts — read templates from disk

## 2. QA Service

- [ ] 2.1 Create packages/backend/src/services/qa_service.ts — call OpenAI-compatible API with paper content + prompt
- [ ] 2.2 Implement content resolution using content_priority from config

## 3. QA API

- [ ] 3.1 Create packages/backend/src/api/qa.ts with endpoints:
  - GET /api/papers/:id/qa — list QA entries for a paper
  - POST /api/papers/:id/qa/template — trigger all missing template Q&A
  - POST /api/papers/:id/qa/template/:name/regenerate — regenerate a template
  - POST /api/papers/:id/qa/free — submit free question
  - POST /api/qa/:entryId/regenerate — regenerate with specified models
  - GET /api/templates — list available templates
- [ ] 3.2 Register QA routes in index.ts

## 4. Frontend

- [ ] 4.1 Create packages/frontend/src/stores/qa.ts — Pinia store for QA operations
- [ ] 4.2 Create packages/frontend/src/components/TemplateQA.vue — template results with status, one-click generate, regenerate
- [ ] 4.3 Create packages/frontend/src/components/FreeQA.vue — floating input with model checkboxes, history
- [ ] 4.4 Update QAPage.vue — standalone Q&A page with paper selector
