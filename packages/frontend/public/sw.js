// Paperland service worker: exists only so the site is installable as an app.
// It caches nothing and never calls respondWith, so every request (API, SSE,
// WebSocket, session cookies) goes to the network exactly as without it.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
