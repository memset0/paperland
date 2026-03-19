# Zotero Plugin

A Zotero 7 plugin that embeds Paperland paper detail pages directly in Zotero's sidebar panel.

## Requirements

- Zotero 7.0+

## Installation

1. Build the plugin:
   ```bash
   cd packages/zotero-plugin
   bun run build
   ```
2. In Zotero, go to **Tools → Add-ons**
3. Click the gear icon → **Install Add-on From File...**
4. Select `packages/zotero-plugin/build/paperland-for-zotero.xpi`

## Configuration

Open **Tools → Add-ons → Paperland → Preferences** and configure:

| Setting | Description | Example |
|---------|-------------|---------|
| **Host URL** | Your Paperland instance URL | `https://paperland.example.com` |
| **Username** | Basic Auth username (leave empty if auth is disabled) | `admin` |
| **Password** | Basic Auth password | `secret` |
| **API Token** | Bearer token for the External API | `sk-a1b2c3...` |

Generate an API token from **Paperland → Settings → API Tokens**.

## How It Works

1. Select a paper in your Zotero library
2. The plugin extracts the arXiv ID from the item's metadata:
   - `archiveID` field (e.g., `arXiv:2603.04948`) — primary source
   - `Extra` field — fallback
   - `URL` field (e.g., `https://arxiv.org/abs/2603.04948`) — last resort
3. Looks up the paper in Paperland via the External API (`/external-api/v1/papers/full?arxiv_id=...&auto_create=true`)
4. If the paper doesn't exist, it is created automatically and services (arXiv fetch, Semantic Scholar, etc.) run in the background
5. The paper's detail page loads in an embedded browser in the sidebar panel

## Supported Item Types

Currently only papers with arXiv IDs are supported. Items without an arXiv ID show a placeholder message. DOI and title-based lookup may be added in the future.

## Architecture

The plugin is a minimal Zotero 7 Bootstrap plugin:

```
packages/zotero-plugin/
├── addon/
│   ├── manifest.json    # Plugin metadata (Zotero 7 compatibility)
│   ├── bootstrap.js     # Entry point — lifecycle + all plugin logic
│   ├── prefs.js         # Default preference values
│   ├── content/
│   │   ├── preferences.xhtml   # Settings UI
│   │   └── icon.svg            # Panel icon
│   └── locale/
│       └── en-US/
│           └── paperland.ftl   # Localization strings
├── scripts/
│   └── build.sh         # Builds .xpi (zip)
└── build/
    └── paperland-for-zotero.xpi   # Output (gitignored)
```

Key APIs used:
- `Zotero.ItemPaneManager.registerSection()` — registers the sidebar panel
- `Zotero.Prefs.get/set()` — persistent preference storage
- `fetch()` — External API calls with Bearer token auth
- Embedded `iframe` with Basic Auth credentials for page display
