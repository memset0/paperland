## Why

Each mind-map node currently shows up to four action icons (add child, add sibling, rename, delete) inline next to its title. That's visually noisy and crowds the node. The actions should be tucked away and only revealed on demand.

## What Changes

- **Actions move to a tooltip below the node**: The per-node action buttons (add child, add sibling, rename, delete — the center node only offers add-child) SHALL no longer be shown inline. They appear in a tooltip **directly below** the node.
- **Desktop**: hovering a node reveals the tooltip (hover-bridged so the user can move into it); **clicking the node opens its editor** — unchanged.
- **Touch (no hover)**: to avoid mis-taps, **tapping a node reveals the tooltip instead of opening the editor**; the touch tooltip additionally includes an **Edit** action to open the editor, and dismisses on an outside tap.

## Capabilities

### Modified Capabilities
- `note-mindmap`: per-node actions are no longer inline; they appear in a hover tooltip positioned directly below the node. Clicking the node still opens its editor.

## Impact

- **Frontend only.** `packages/frontend/src/components/notes/NoteNode.vue` (remove the inline `.nn-actions`; render the actions in a hover-revealed tooltip positioned below the node, with hover-bridge behavior so it stays open while moving into it). No store/API change.
- **Docs**: `docs/frontend-architecture.md` (mind-map node interactions).
