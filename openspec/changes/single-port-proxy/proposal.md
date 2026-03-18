## Why

The service needs to be accessed through a reverse proxy that only exposes a single port. Currently the frontend (5173) and backend (3000) run on separate ports, requiring both to be exposed. Users need to access everything through port 5173 only.

## What Changes

- Configure Vite dev server to listen on `0.0.0.0` so it's accessible from external reverse proxies
- Ensure Vite proxy forwards all `/api` and `/external-api` requests to the backend
- Configure backend to listen on `127.0.0.1` only (not externally accessible, accessed only via Vite proxy)
- Update dev scripts so both services start together with the correct binding

## Capabilities

### New Capabilities
- `single-port-access`: All traffic (frontend pages + API requests) routed through a single port (5173) via Vite's built-in proxy to the backend

### Modified Capabilities

(none)

## Impact

- **Config changes**: vite.config.ts, packages/backend/src/index.ts
- **No new dependencies**
- **Deployment**: Only port 5173 needs to be exposed through reverse proxy
