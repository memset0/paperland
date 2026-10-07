## Context

See proposal.md. The backend already depends on @fastify/static but currently serves only APIs and stored files. Caddy points Paperland to a stopped Vite process. The existing backend was started from the project root and must keep that working directory for the real SQLite database.

## Goals / Non-Goals

Provide production hosting without Vite; preserve the development command, existing authentication, and streaming. Do not change the database, API contracts, or other Caddy sites.

## Decisions

- Add a small separately testable hosting registration function using existing @fastify/static with serve:false. Explicit root/wildcard GET routes serve files safely and apply SPA fallback only after excluding server namespaces and missing assets.
- Enable hosting when packages/frontend/dist/index.html exists. This avoids adding a second configuration source and allows API-only startup before building.
- Cache entry HTML with no-cache and build assets with immutable caching. Restrict resolved file paths to the build root.
- Register hosting after API routes so specific routes remain authoritative. Preserve loopback port 3000.
- Use a systemd backend service with WorkingDirectory set to the project root, preserve configured model environment variables privately, and route only the existing Paperland Caddy block to port 3000 with flush_interval -1.

## Risks / Trade-offs

[Restart can interrupt active model work] → Check pending/running executions before restarting and wait or surface active work.
[Old HTML can refer to missing chunks] → Rebuild before restart and prevent long-lived HTML caching.
[Disk is nearly full] → Limit cleanup to rebuildable tooling caches; surface additional storage blockers if deployment cannot proceed.

## Migration Plan

Run focused offline hosting tests, frontend type checking and production build. Check for active work, persist environment, install the Paperland systemd unit, replace the old backend process, validate/reload the one Caddy route, and verify public SPA, assets, health, and missing API responses. For rollback, restore the saved Caddy block and backend service configuration.
