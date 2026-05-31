import { reactive } from 'vue'

/**
 * Shared drag state for the note mind-map. Pointer-events-based dragging works on both touch
 * and mouse. Ids are section ids (strings) within the note document; the center node ('') is
 * never a drag source. `draggingId` = the node being dragged; `overId` = the node hovered over.
 */
export const noteDrag = reactive<{ draggingId: string | null; overId: string | null }>({
  draggingId: null,
  overId: null,
})
