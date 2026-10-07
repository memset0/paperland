## Why

The existing Paperland hostname proxies to a stopped Vite server, leaving the site unavailable while its backend continues to run. Production should serve the built frontend and APIs from the existing backend through the same HTTPS hostname.

## What Changes

- Mount the frontend production build in the Fastify backend when its index.html exists, with SPA navigation fallback.
- Keep API, external API, image storage, and missing asset responses separate from SPA fallback.
- Preserve Vite development on port 5173 and the backend's loopback-only binding.
- Rebuild the frontend, run the backend persistently from the project root, and point the existing Caddy hostname at port 3000 with unbuffered streaming.
- Update all three architecture/API documents for the production entry point.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `single-port-access`: distinguish the Vite development entry point from the production backend-hosted frontend and API entry point.

## Impact

Backend startup and a small frontend hosting module with offline HTTP tests; frontend build artifacts; docs/frontend-architecture.md, docs/external-api.md, docs/tech-stack.md. Deployment updates are limited to Paperland's Caddy route and a backend systemd service. No schema, model invocation, or API authentication changes.
