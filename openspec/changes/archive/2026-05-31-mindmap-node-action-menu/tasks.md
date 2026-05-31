## 1. Mind-map node — hover action tooltip

- [x] 1.1 In `components/notes/NoteNode.vue`, remove the inline `.nn-actions` row from the node box (so the node shows only its title + count).
- [x] 1.2 Add a hover-revealed tooltip positioned directly below the node box, containing the action buttons (add child + add sibling/rename/delete for non-center; add child only for the center node). Reuse the existing `addChild` / `addSibling` / `rename` / `del` handlers.
- [x] 1.3 Implement hover-bridge behavior: the tooltip opens on node hover and stays open while the pointer is over the node OR the tooltip; it dismisses when neither is hovered. Ensure tapping the node still opens the editor (tooltip must not block the tap / drag-threshold logic).
- [x] 1.4 Make the tooltip touch-usable (it currently always-shows on touch via `nn-actions-touch`; replace with an equivalent reveal that doesn't clutter the node, e.g. show below on focus/long-press) and ensure it floats above sibling nodes (z-index) without being clipped by the mind-map's horizontal scroll container.

## 2. Docs

- [x] 2.1 Update `docs/frontend-architecture.md` mind-map section: per-node actions now live in a hover tooltip below the node; click still edits.

## 3. Verify

- [x] 3.1 `vue-tsc --noEmit` clean.
- [x] 3.2 Manual QA: hover shows the action tooltip below the node; moving into it keeps it open; clicking actions works; clicking the node still opens the editor; tooltip dismisses on leave.
