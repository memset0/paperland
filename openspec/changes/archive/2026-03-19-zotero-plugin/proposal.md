## Why

Paperland is a self-hosted paper management web app, but users still browse and organize papers primarily in Zotero. Currently there's no way to view Paperland's Q&A results, service outputs, or paper details without manually opening the browser and navigating to the correct paper. A Zotero plugin that embeds the Paperland detail page directly in the sidebar eliminates this context-switch, making Paperland's value accessible right where users read papers.

## What Changes

- **New Zotero 7 plugin** (`packages/zotero-plugin/`): Bootstrap-based plugin that adds a sidebar panel to Zotero
- **Sidebar panel**: Embeds the Paperland paper detail page (`/papers/:id`) in an iframe, occupying the full sidebar area
- **arXiv ID extraction**: Reads the `arXiv:XXXX.XXXXX` identifier from the currently selected Zotero item's "Extra" field or archive ID
- **Auto-create flow**: When a paper doesn't exist in Paperland yet, automatically creates it via the external API (`GET /external-api/v1/papers/full?arxiv_id=...&auto_create=true`)
- **Plugin preferences**: Configurable host URL, Basic Auth credentials (username/password for page access), and API Bearer token (for external API calls)
- **Placeholder state**: When selected item has no arXiv ID, sidebar shows a placeholder message

## Capabilities

### New Capabilities

- `zotero-sidebar-panel`: Zotero 7 sidebar panel that displays Paperland paper detail page via iframe, with arXiv ID extraction and auto-navigation
- `zotero-plugin-preferences`: Plugin settings UI for configuring Paperland host, Basic Auth credentials, and API token
- `zotero-paper-lookup`: Logic to extract arXiv ID from Zotero item, look up or auto-create the paper in Paperland via external API, and resolve the detail page URL

### Modified Capabilities

_(none — all changes are additive; no existing specs or APIs need modification)_

## Impact

- **New package**: `packages/zotero-plugin/` added to the Bun workspace monorepo
- **Build tooling**: Zotero plugin needs its own build process (zip packaging for `.xpi` distribution)
- **External API usage**: Plugin calls `GET /external-api/v1/papers/full` with Bearer token — no API changes needed, endpoint already supports `auto_create=true`
- **Frontend**: No changes needed — the iframe loads existing pages with Basic Auth
- **Dependencies**: Zotero 7 plugin SDK conventions (manifest.json, bootstrap.js entry point)
