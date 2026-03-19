## Context

Paperland is a self-hosted paper management web app running as a Bun monorepo. Users primarily organize papers in Zotero and want to see Paperland's Q&A results and paper details without leaving Zotero. The external API already supports looking up papers by arXiv ID with auto-creation (`GET /external-api/v1/papers/full?arxiv_id=...&auto_create=true`), so no backend changes are needed.

Zotero 7 (released 2024) uses a Bootstrap-based plugin architecture — plugins are `.xpi` files containing a `manifest.json` and a `bootstrap.js` entry point. Sidebar panels are registered via `ztoolkit.ItemPane` or the native `Zotero.ItemPaneManager.registerSection()` API.

## Goals / Non-Goals

**Goals:**
- Zotero 7 sidebar panel that shows the Paperland detail page for the selected paper
- Automatic paper lookup/creation via arXiv ID extracted from Zotero item metadata
- Configurable host, Basic Auth credentials, and API token via Zotero's preferences system
- Clean placeholder state when no arXiv paper is selected

**Non-Goals:**
- Zotero 6 support (legacy XUL overlay architecture)
- Tag synchronization between Zotero and Paperland (planned for future)
- Bidirectional sync (Paperland → Zotero)
- PDF upload from Zotero to Paperland
- Support for non-arXiv identifiers (DOI, Semantic Scholar corpus ID) — can be added later

## Decisions

### 1. Plugin architecture: Zotero 7 Bootstrap plugin with zotero-plugin-template

**Decision**: Use the community `zotero-plugin-template` scaffolding or a minimal hand-rolled bootstrap plugin.

**Rationale**: Zotero 7 plugins use `manifest.json` + `bootstrap.js`. The community template provides build tooling (esbuild/webpack), hot-reload dev mode, and `.xpi` packaging. However, since our plugin is minimal (one sidebar panel, one preferences page), a hand-rolled approach keeps dependencies light.

**Choice**: Hand-rolled minimal plugin. The plugin only needs:
- `manifest.json` — plugin metadata, Zotero 7 compatibility
- `bootstrap.js` — entry point (startup/shutdown lifecycle)
- `content/` — XUL/XHTML for preferences pane
- `locale/` — i18n strings (en-US at minimum)

A simple build script (shell or Bun) zips these into an `.xpi`.

**Alternative considered**: `zotero-plugin-template` — overkill for our scope, brings in webpack/React/complex build chain.

### 2. Sidebar panel: Zotero.ItemPaneManager.registerSection()

**Decision**: Use the native Zotero 7 `Zotero.ItemPaneManager.registerSection()` API to register a custom section in the item pane.

**Rationale**: Zotero 7 introduced `ItemPaneManager` as the official way to add custom panels to the right-side item pane. This gives us a full panel area where we can embed a `browser` (XUL iframe-like element) that loads the Paperland page.

The panel renders when the user selects an item. On item selection change, we:
1. Extract arXiv ID from the item
2. Call external API to resolve/create the paper
3. Load the Paperland detail page URL in the embedded browser

### 3. arXiv ID extraction strategy

**Decision**: Extract arXiv ID from Zotero item fields in this priority order:
1. `item.getField('archiveID')` — Zotero stores arXiv IDs here when imported from arXiv (format: `arXiv:XXXX.XXXXX`)
2. `item.getField('extra')` — fallback, parse `arXiv: XXXX.XXXXX` from the Extra field
3. `item.getField('url')` — fallback, parse from arxiv.org URL pattern

**Rationale**: Zotero's arXiv translator stores the identifier in `archiveID` with the `arXiv:` prefix. The Extra field is a common fallback. URL parsing catches edge cases.

The `arXiv:` prefix is stripped before sending to the Paperland API (which expects just `XXXX.XXXXX`).

### 4. Authentication: Basic Auth in URL for iframe, Bearer token for API calls

**Decision**: Two separate auth mechanisms:
- **Page embedding**: Construct URL as `https://username:password@host/papers/:id` for the embedded browser. Alternatively, use Zotero's internal channel APIs to inject `Authorization` headers.
- **API calls**: Use `fetch()` with `Authorization: Bearer <token>` header for external API calls (paper lookup/creation).

**Rationale**: The Paperland frontend uses HTTP Basic Auth (or no auth if disabled). Zotero's embedded browser is based on Gecko, which still supports Basic Auth in URLs. If that approach has issues, we can fall back to `nsIHttpAuthManager` to pre-register credentials for the host.

**Alternative considered**: Modifying the frontend to accept token-based auth — rejected because it adds unnecessary complexity and diverges from the current auth model.

### 5. Package location: `packages/zotero-plugin/` in the monorepo

**Decision**: Add as a new package in the existing Bun workspace.

**Rationale**: Keeps the plugin close to the project it integrates with. Shared types from `@paperland/shared` can be referenced (though the plugin runs in Zotero's environment, not in a browser/Node). The build output (`.xpi`) is self-contained.

The plugin will have its own `package.json` but uses plain TypeScript/JS without Vue or Vite. Build produces a `.xpi` file.

### 6. Paper ID caching

**Decision**: Cache the mapping `arXiv ID → Paperland internal ID` in Zotero's `Zotero.Prefs` or a simple in-memory Map during the session.

**Rationale**: Avoids redundant API calls when switching between papers the user has already viewed. The cache is best-effort — if not found, we just re-query the API.

## Risks / Trade-offs

- **Basic Auth in URL deprecation** → Gecko (Zotero's engine) still supports it, but if issues arise, fall back to `nsIHttpAuthManager` credential injection. Test during implementation.
- **Zotero API stability** → `ItemPaneManager` is relatively new in Zotero 7. API may change in minor versions. Mitigation: pin minimum Zotero version in manifest, follow Zotero developer forums.
- **Network latency for auto-create** → First-time paper creation triggers service execution (arXiv fetch, Semantic Scholar, etc.) which takes ~15 seconds. Mitigation: show a loading state in the sidebar while waiting; the `/papers/full` endpoint already waits for services before responding.
- **No arXiv ID** → Many Zotero items won't have arXiv IDs. The plugin gracefully shows a placeholder. Future work can add DOI/title fallback.

## Open Questions

- Should the plugin auto-refresh the iframe when the Paperland page updates (e.g., after Q&A results come in), or rely on the user refreshing? For now, the embedded page's own reactivity (Vue) handles updates within the SPA — no plugin-level refresh needed.
