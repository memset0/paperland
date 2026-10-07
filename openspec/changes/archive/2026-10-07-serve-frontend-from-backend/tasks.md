## 1. Backend frontend hosting

- [x] 1.1 Implement optional frontend build registration after API routes; verify offline Fastify tests cover root/deep links/HEAD, MIME/cache headers, existing API precedence, missing API/image/assets, rejected traversal, non-GET requests, and absent builds.
- [x] 1.2 Update docs/frontend-architecture.md, docs/external-api.md, and docs/tech-stack.md for backend production hosting and the retained Vite development workflow; verify consistency with the single-port-access delta.

## 2. Build and deployment

- [x] 2.1 Run frontend type checking and production build plus focused hosting tests without external services; verify the dist entry and assets exist.
- [x] 2.2 Check active backend work, preserve required model environment privately, install a project-root systemd backend service, and restart; verify loopback binding, the health endpoint, and frontend entry on port 3000.
- [x] 2.3 Change only Paperland's Caddy upstream to port 3000 with unbuffered streaming; validate/reload Caddy and verify public HTTPS root, deep links, built assets, health, and non-HTML unknown API responses.

## 3. Finalize

- [x] 3.1 Review final implementation and deployment evidence against artifacts, validate this change strictly, and verify all tasks are complete before archive.

## Deployment verification

- Nine focused offline hosting tests passed (65 assertions); frontend vue-tsc and Vite production build passed.
- Backend had no pending/running executions before restart; paperland.service is enabled and active from the project root on 127.0.0.1:3000.
- Only Paperland's Caddy block changed; Caddy validation and reload succeeded.
- Public HTTPS root/deep link returned 200 HTML, built JavaScript returned correct MIME and immutable cache, health returned status=ok, and unknown API returned 404 JSON.
- Required environment variables are stored privately in /etc/paperland/backend.env; deployment rollback copy is under /root/.local/state/paperland-deploy/.
- Disk analysis found exhausted unprivileged space; additional cache deletion remains subject to the user's pending choice. No project data, session history, or swap was deleted.
