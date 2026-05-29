import { reactive } from 'vue'

/**
 * Shared drag state for the note mind-map. Pointer-events-based dragging works on both
 * touch and mouse (unlike HTML5 drag-and-drop, which doesn't fire on touch devices).
 * `draggingId` = the node currently being dragged; `overId` = the node it's hovering over.
 */
export const noteDrag = reactive<{ draggingId: number | null; overId: number | null }>({
  draggingId: null,
  overId: null,
})
