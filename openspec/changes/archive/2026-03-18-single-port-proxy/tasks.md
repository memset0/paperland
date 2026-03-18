## 1. Configuration Changes

- [x] 1.1 Update vite.config.ts: set server.host to '0.0.0.0' for external access
- [x] 1.2 Update vite.config.ts: ensure proxy config includes ws:true for WebSocket support
- [x] 1.3 Update backend src/index.ts: change listen host from '0.0.0.0' to '127.0.0.1'

## 2. Verification

- [x] 2.1 Verify frontend accessible on 0.0.0.0:5173
- [x] 2.2 Verify API requests proxied through 5173 to backend
