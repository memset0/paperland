import { useBlockAnchor } from '@/composables/useBlockAnchor'
import { useQAConversation } from '@/composables/useQAConversation'

/**
 * Bring one answer into view on the current paper page: in the conversation view when it is shown
 * (the tab ending at that answer, else a new tab), otherwise revealed in the Q&A list (expanded,
 * with that answer selected). Used by completion notices and the `?qa=…&thread=1` deep link.
 */
export function useQAJump() {
  const conversation = useQAConversation()
  const { revealQAEntry } = useBlockAnchor()

  async function openResult(entryId: number, resultId: number) {
    if (conversation.visible.value) conversation.openThread(entryId, resultId)
    else await revealQAEntry(entryId, resultId)
  }

  return { openResult }
}

/** Paper-page URL that opens an answer the same way (used for new-tab opens). */
export function qaResultUrl(paperId: number, entryId: number, resultId: number): string {
  return `/papers/${paperId}?qa=${entryId}&result=${resultId}&thread=1`
}
