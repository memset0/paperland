import { ref } from 'vue'

/**
 * Shared "open a public note in the right panel" state.
 *
 * A `?note=<id>` deep link (handled in `PaperDetail`) or a click on the notes list sets
 * `requestedPublicNote`; consumers react without prop drilling (mirrors `usePdfNavigation`):
 *  - `PaperViewerPanel` switches the right panel to the Note tab;
 *  - `PublicNotesPanel` expands that note's entry, fetches its body, and scrolls to it.
 *
 * Each request is a fresh object so re-issuing the same note id re-triggers the watchers.
 */
export interface PublicNoteRequest {
  noteId: number
}

export const requestedPublicNote = ref<PublicNoteRequest | null>(null)

export function usePublicNoteOpen() {
  function requestPublicNote(noteId: number) {
    requestedPublicNote.value = { noteId }
  }
  return { requestedPublicNote, requestPublicNote }
}
