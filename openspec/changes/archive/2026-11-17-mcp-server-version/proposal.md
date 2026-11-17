# Proposal

## Why

The MCP server reports a hardcoded `serverInfo.version` of `1.0.0`. MCP clients and the people using them cannot tell when Paperland's MCP server changed. The developer wants that version to follow Paperland's own version.

## What Changes

- `initialize` returns `serverInfo.version` equal to the root `package.json` `version`, which is the same version the frontend footer shows.
- The `initialize` instructions open with `Paperland MCP server <version>.`, so clients that only surface instructions also show it.
- The version is read once at backend startup. An archive bumps the version and the deploy restarts the backend, so the two stay in sync.

## Capabilities

### New Capabilities

### Modified Capabilities
- `research-agent-tools`: the MCP server version follows the Paperland version.

## Impact

- Backend: a new `version.ts` helper; `api/mcp.ts`; tests.
- Docs: `external-api.md`, `tech-stack.md`.
