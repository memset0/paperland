## 1. Backend Scope and Authorization

- [x] 1.1 Add validated `scope=mine|all` to paper QA reads with mine/anonymous-preset defaults; verify API tests for anonymous, owner mine, and non-admin all
- [x] 1.2 Refactor feed count/page queries to filter and paginate in SQL for both scopes; verify totals/order/page boundaries with multiple users
- [x] 1.3 Return asker identity and a consistent viewer management capability without N+1 user lookups; verify response fixtures for resolved and legacy-null users
- [x] 1.4 Enforce owner-or-admin regeneration/deletion independently of scope; verify direct non-owner calls return 404 and owner/admin calls succeed

## 2. Shared Store and UI

- [x] 2.1 Update shared/feed/paper QA types and separate PaperDetail/feed scope state; verify TypeScript checks cover asker and management fields
- [x] 2.2 Add mine/all selector and asker labels to User Q&A on PaperDetail; verify Preset Q&A and anonymous behavior remain unchanged
- [x] 2.3 Generalize `/qa` header scope control to every authenticated user and reset pagination on switch; verify mine/all page requests and labels
- [x] 2.4 Hide management actions on another user's entry while preserving copy/pin/read behavior; verify PaperDetail and feed use the same authorization presentation

## 3. Documentation and Verification

- [x] 3.1 Update `docs/frontend-architecture.md`, `docs/external-api.md`, and `docs/tech-stack.md` for mine/all behavior and unchanged External API/schema; verify docs match route parameters
- [x] 3.2 Run focused QA auth/pagination tests plus backend/frontend builds with no external calls; verify all pass
- [x] 3.3 Run strict OpenSpec validation and final diff audit; verify no unrelated paths are staged and `packages/backend/data/` is absent

