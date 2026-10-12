## 1. Display names

- [x] 1.1 Audit regular-user attribution in Q&A, notes, reference links and highlights; verify nickname-first display-name enrichment and labels/tooltips by inspecting frontend and backend references.
- [x] 1.2 Update leaderboard formatter so podium, tooltip and overflow rows show only nickname when set; verify nickname, absent/empty nickname, missing username and unattributed cases with local assertions.

## 2. Documentation and verification

- [x] 2.1 Update docs/frontend-architecture.md, docs/external-api.md and docs/tech-stack.md; verify descriptions agree with nickname-only UI and compatible API payloads.
- [x] 2.2 Run queued frontend verification build into scratch output, inspect final diff and validate OpenSpec change strictly.

## 3. Deployment

- [x] 3.1 Deploy with `bun run build:frontend`; verify live health returns 200 and the served index, entry assets and Home page bundle match the production build.
