## 1. Selection Logic

- [x] 1.1 Add pure latest-result comparison/newest-first sorting helpers with completed_at then id fallback; verify focused unit tests cover normal, tied, and invalid timestamps
- [x] 1.2 Add pure active-selection transition logic for initial render, newly added ids, equivalent refreshes, deleted selection, and requested anchor priority; verify all state cases in unit tests

## 2. QAResultView Integration

- [x] 2.1 Replace empty controlled-tab initialization/default-value reliance with helper-driven active id; verify first render selects the newest result
- [x] 2.2 Watch stable result signatures so new answers become active while equivalent polling preserves manual selection; verify controlled component tests or helper integration behavior
- [x] 2.3 Order displayed tabs newest-first after pinned-model precedence and preserve explicit requestedResultId navigation; verify repeated same-model results remain distinct by id

## 3. Documentation and Verification

- [x] 3.1 Update `docs/frontend-architecture.md`, `docs/external-api.md`, and `docs/tech-stack.md` to document latest-default frontend behavior and unchanged APIs/schema
- [x] 3.2 Run focused helper tests, frontend production build, strict OpenSpec validation, and final diff audit; verify no backend/database files are modified by this change
