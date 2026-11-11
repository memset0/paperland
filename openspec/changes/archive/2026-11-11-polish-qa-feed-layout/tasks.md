## 1. Feed presentation

- [x] 1.1 Refactor feed card hierarchy and independent collapsible/actions; verify desktop/phone rendering, full expanded question, and keyboard toggling with agent-browser.
- [x] 1.2 Update scope toolbar, count, skeletons, empty state, and pagination; verify narrow-screen geometry and loading/empty/paging behavior in agent-browser with local fixtures where needed.
- [x] 1.3 Update docs/frontend-architecture.md, docs/external-api.md, and docs/tech-stack.md to describe the final feed UI and unchanged API contracts; verify the focused diff.

## 2. Integration and deployment

- [x] 2.1 Verify light/dark themes, All-scope asker/private metadata, background controls, result tabs, copy controls, and preserved permissions through agent-browser without triggering live generation; validate the OpenSpec change and review the implementation diff.
- [x] 2.2 Deploy through the queued bun run build:frontend command from the root, verify service health and production assets, and inspect the deployed public page with agent-browser; record evidence and keep the change active for user review.

## Workflow follow-up

- User review and archive/commit/push were explicitly authorized on 2026-11-11.
- Complete the archive with synced specs, a patch version bump, and an exact-path commit/push to main.
