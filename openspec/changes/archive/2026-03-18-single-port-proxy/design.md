## Context

Currently the Vite dev server runs on port 5173 and the Fastify backend on port 3000. Vite already has proxy config for `/api` and `/external-api`, but Vite only listens on localhost and the backend listens on `0.0.0.0`. We need to invert this: Vite listens on `0.0.0.0`, backend on `127.0.0.1`.

## Goals / Non-Goals

**Goals:**
- Single port (5173) serves everything: frontend + proxied API requests
- Backend only accessible internally via localhost

**Non-Goals:**
- Production deployment setup (this is dev mode only)
- HTTPS termination (handled by external reverse proxy)

## Decisions

### 1. Vite listens on 0.0.0.0

Set `server.host: '0.0.0.0'` in vite.config.ts. This allows external access through reverse proxy.

### 2. Backend listens on 127.0.0.1 only

Change Fastify `host` from `0.0.0.0` to `127.0.0.1`. The backend is only accessed via Vite's proxy, never directly from outside.

### 3. WebSocket proxy for HMR

Add `ws: true` to Vite proxy config so WebSocket connections (used by Vite HMR) also work through the reverse proxy.

## Risks / Trade-offs

- **[Risk] Vite proxy adds latency to API calls** → Negligible for a personal project. In production, a proper reverse proxy (nginx) would handle this.
