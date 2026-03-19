## 1. Project Scaffolding

- [x] 1.1 Create `packages/zotero-plugin/` directory with `package.json` (name: `@paperland/zotero-plugin`)
- [x] 1.2 Create `manifest.json` with Zotero 7 plugin metadata (id, name, version, Zotero compatibility range, bootstrap flag)
- [x] 1.3 Create `bootstrap.js` with startup/shutdown lifecycle stubs (empty `install`, `startup`, `shutdown`, `uninstall` functions)
- [x] 1.4 Create build script that packages the plugin directory into a `.xpi` file (zip with `.xpi` extension)

## 2. Preferences System

- [x] 2.1 Create `prefs.js` with default preference definitions: `host` (string), `username` (string), `password` (string), `api_token` (string)
- [x] 2.2 Create preferences XHTML pane (`content/preferences.xhtml`) with input fields for host, username, password (type=password), and API token
- [x] 2.3 Wire preferences pane into `manifest.json` so it appears in Add-ons Manager
- [x] 2.4 Create helper module `src/prefs.ts` to read/write preferences via `Zotero.Prefs` with the plugin's pref branch

## 3. arXiv ID Extraction

- [x] 3.1 Create `src/arxiv.ts` module with function to extract arXiv ID from a Zotero item: check `archiveID` → `extra` → `url` fields in priority order
- [x] 3.2 Strip `arXiv:` prefix and validate the ID format (e.g., `YYMM.NNNNN` or legacy `category/NNNNNNN`)
- [x] 3.3 Handle edge cases: null item, item without arXiv ID (return null)

## 4. Paperland API Client

- [x] 4.1 Create `src/api.ts` module with function to call `GET /external-api/v1/papers/full?arxiv_id={id}&auto_create=true` using `fetch()` with Bearer token from preferences
- [x] 4.2 Parse API response to extract paper internal `id`
- [x] 4.3 Implement in-memory cache (Map<string, number>) for arXiv ID → Paperland ID mapping
- [x] 4.4 Handle error cases: network failure, invalid token (401), server error (500) — return structured error object

## 5. Sidebar Panel

- [x] 5.1 In `bootstrap.js` startup, register an item pane section via `Zotero.ItemPaneManager.registerSection()` with label "Paperland"
- [x] 5.2 Create panel content: a container `div` with a `browser`/`iframe` element filling the full panel area, plus a placeholder `div` and a loading `div`
- [x] 5.3 Implement item selection handler (`onItemChange` or equivalent): extract arXiv ID → resolve paper ID → load URL in browser
- [x] 5.4 Implement Basic Auth for the embedded browser (try URL-encoded credentials first: `https://user:pass@host/papers/id`; fall back to `nsIHttpAuthManager` if needed)
- [x] 5.5 Implement state transitions: placeholder (no arXiv ID) ↔ loading (API call in progress) ↔ paper page (loaded)
- [x] 5.6 In `bootstrap.js` shutdown, unregister the item pane section and clean up listeners

## 6. Build & Packaging

- [x] 6.1 Create `scripts/build.sh` (or `build.ts`) that: compiles TypeScript sources (if any) → copies manifest.json, bootstrap.js, prefs.js, content/, locale/ → zips into `build/paperland-for-zotero.xpi`
- [x] 6.2 Add `"build"` script to `packages/zotero-plugin/package.json`
- [x] 6.3 Create `locale/en-US/` with plugin name and description strings
- [x] 6.4 Test: install the built `.xpi` in Zotero 7, verify panel appears, preferences work, and paper pages load

## 7. Documentation

- [x] 7.1 Update `docs/` with a new `zotero-plugin.md` documenting plugin installation, configuration, and usage
- [x] 7.2 Add brief mention in project README or main docs about the Zotero integration
