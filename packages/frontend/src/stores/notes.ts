import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { notesApi } from '@/api/client'
import type { Note } from '@paperland/shared'

/** A note with its children resolved — what the mind-map / tree views render. */
export interface NoteTreeNode extends Note {
  children: NoteTreeNode[]
}

/** Assemble the flat note list into a sorted forest by `parent_id` / `sort_order`. */
export function buildTree(flat: Note[]): NoteTreeNode[] {
  const byId = new Map<number, NoteTreeNode>()
  for (const n of flat) byId.set(n.id, { ...n, children: [] })
  const roots: NoteTreeNode[] = []
  for (const node of byId.values()) {
    const parent = node.parent_id != null ? byId.get(node.parent_id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const sortRec = (nodes: NoteTreeNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order)
    nodes.forEach((n) => sortRec(n.children))
  }
  sortRec(roots)
  return roots
}

/** Collect a note id and all of its descendants from a flat list. */
function collectSubtree(rootId: number, flat: Note[]): Set<number> {
  const childrenOf = new Map<number, number[]>()
  for (const n of flat) {
    if (n.parent_id != null) {
      const list = childrenOf.get(n.parent_id) ?? []
      list.push(n.id)
      childrenOf.set(n.parent_id, list)
    }
  }
  const ids = new Set<number>()
  const stack = [rootId]
  while (stack.length) {
    const cur = stack.pop()!
    ids.add(cur)
    for (const c of childrenOf.get(cur) ?? []) stack.push(c)
  }
  return ids
}

export const useNotesStore = defineStore('notes', () => {
  const walkthrough = ref<Note | null>(null)
  const notes = ref<Note[]>([]) // flat small notes for the current paper
  const currentPaperId = ref<number | null>(null)
  const loading = ref(false)

  // Front-end-only undo stack for drag reparent/reorder. Each entry is the note's
  // position BEFORE a move; cleared when a note is created (per the product spec).
  const moveHistory = ref<Array<{ noteId: number; parentId: number | null; sortOrder: number }>>([])

  const tree = computed(() => buildTree(notes.value))

  async function fetchForPaper(paperId: number) {
    currentPaperId.value = paperId
    moveHistory.value = []
    loading.value = true
    try {
      const res = await notesApi.getForPaper(paperId)
      // Ignore late responses for a paper the user already navigated away from.
      if (currentPaperId.value !== paperId) return
      walkthrough.value = res.walkthrough
      notes.value = res.notes
    } finally {
      loading.value = false
    }
  }

  async function saveWalkthrough(body: string) {
    const paperId = currentPaperId.value
    if (paperId == null) return
    const res = await notesApi.saveWalkthrough(paperId, body, walkthrough.value?.updated_at)
    walkthrough.value = res.data
    return res.data
  }

  async function createNote(data: { title?: string | null; body?: string; parent_id?: number | null }) {
    const paperId = currentPaperId.value
    if (paperId == null) return
    const res = await notesApi.create(paperId, data)
    notes.value.push(res.data)
    moveHistory.value = [] // a new note invalidates the move-undo history
    return res.data
  }

  async function updateNote(id: number, data: { title?: string | null; body?: string }) {
    const current = notes.value.find((n) => n.id === id)
    const res = await notesApi.update(id, { ...data, updated_at: current?.updated_at })
    const idx = notes.value.findIndex((n) => n.id === id)
    if (idx !== -1) notes.value[idx] = res.data
    return res.data
  }

  /**
   * Reparent/reorder optimistically; roll back if the server rejects (e.g. a cycle).
   * `record` pushes the prior position onto the undo stack (false when applying an undo).
   */
  async function moveNote(id: number, parent_id: number | null, sort_order: number, record = true) {
    const idx = notes.value.findIndex((n) => n.id === id)
    if (idx === -1) return
    const prev = notes.value[idx]
    notes.value[idx] = { ...prev, parent_id, sort_order }
    try {
      const res = await notesApi.move(id, { parent_id, sort_order })
      notes.value[idx] = res.data
      if (record) moveHistory.value.push({ noteId: id, parentId: prev.parent_id, sortOrder: prev.sort_order })
    } catch (e) {
      notes.value[idx] = prev // rollback
      throw e
    }
  }

  /** Undo the most recent drag move, restoring the note to its previous position. */
  async function undoMove() {
    const entry = moveHistory.value.pop()
    if (!entry) return
    await moveNote(entry.noteId, entry.parentId, entry.sortOrder, false).catch(() => {})
  }

  async function removeNote(id: number) {
    await notesApi.remove(id)
    const ids = collectSubtree(id, notes.value)
    notes.value = notes.value.filter((n) => !ids.has(n.id))
    moveHistory.value = moveHistory.value.filter((e) => !ids.has(e.noteId)) // drop dead undo entries
    if (walkthrough.value?.id === id) walkthrough.value = null
  }

  return {
    walkthrough, notes, tree, currentPaperId, loading, moveHistory,
    fetchForPaper, saveWalkthrough, createNote, updateNote, moveNote, removeNote, undoMove,
  }
})
