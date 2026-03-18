## 1. Arxiv Service Implementation

- [x] 1.1 Create packages/backend/src/services/arxiv_service.ts — PaperBoundService implementation
- [x] 1.2 Implement arxiv API metadata fetch (title, authors, abstract, categories) with XML parsing
- [x] 1.3 Implement PDF download to data/pdfs/ directory
- [x] 1.4 Create data/pdfs/ directory with .gitkeep

## 2. Integration

- [x] 2.1 Register arxiv_service with ServiceRunner in packages/backend/src/index.ts
- [x] 2.2 Verify: creating a paper with arxiv_id triggers arxiv_service and populates metadata + PDF
