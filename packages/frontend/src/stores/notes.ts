import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { notesApi } from '@/api/client'
import type { Note } from '@paperland/shared'

/** A note with its children resolved — what the mind-map / tree views render. */
export interface NoteTreeNode extends Note {
  children: NoteTreeNode[]
}

/** Sentinel id for an unsaved, synthetic root node (no root row persisted yet). */
export const SYNTHETIC_ROOT_ID = -1

function syntheticRoot(paperId: number | null): NoteTreeNode {
  return {
    id: SYNTHETIC_ROOT_ID, user_id: 0, paper_id: paperId ?? 0, kind: 'root',
    parent_id: null, title: null, body: '', sort_order: 0,
    created_at: '', updated_at: '', children: [],
  }
}

/**
 * Assemble the flat note list into a single tree rooted at the `root` note.
 * If no root row exists yet, a synthetic (unsaved) root is returned so the
 * mind-map always has a center node to render.
 */
export function buildRootTree(flat: Note[], paperId: number | null): NoteTreeNode {
  const byId = new Map<number, NoteTreeNode>()
  for (const n of flat) byId.set(n.id, { ...n, children: [] })
  for (const node of byId.values()) {
    if (node.kind === 'root') continue
    const parent = node.parent_id != null ? byId.get(node.parent_id) : undefined
    if (parent) parent.children.push(node)
  }
  const rootRow = flat.find((n) => n.kind === 'root')
  const root = rootRow ? byId.get(rootRow.id)! : syntheticRoot(paperId)
  const sortRec = (nodes: NoteTreeNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order)
    nodes.forEach((n) => sortRec(n.children))
  }
  sortRec(root.children)
  return root
}

/** One rendered section of the walkthrough: a note's (numbered) heading plus its body. */
export interface WalkthroughSection {
  /** The note this section belongs to (used to open its editor from the walkthrough). */
  noteId: number
  /** The root's heading-less intro section; every other section has a heading. */
  isRoot: boolean
  /** Heading level 2–6 (H2 for the root's direct children, +1 per depth, clamped); 0 for root. */
  level: number
  /** Hierarchical section number like `1.`, `1.2.`, `1.2.3.` (trailing dot); '' for root. */
  number: string
  /** Display title; '' for root. */
  title: string
  /** Markdown body: a note's body with its own headings re-leveled + numbered ('' when empty); the root's body verbatim. */
  body: string
}

/** Allocates hierarchical outline numbers (`1.`, `1.2.`, `1.2.3.`) across the whole walkthrough. */
function outlineNumberer() {
  const counters: number[] = [] // counters[sl] = current count at section level sl (1-based)
  return (sl: number): string => {
    counters[sl] = (counters[sl] ?? 0) + 1
    counters.length = sl + 1 // drop deeper counters left over from a previous branch
    return counters.slice(1, sl + 1).join('.') + '.'
  }
}

/**
 * Number and re-level the ATX headings inside a note body so they nest *under* the note
 * and share the walkthrough's outline numbering with the note's child notes, in document
 * order. The body's shallowest authored heading sits one level below the note; deeper
 * authored levels keep their relative nesting (mapped to contiguous ranks). Headings inside
 * fenced code blocks and non-heading lines pass through unchanged.
 */
function numberBodyHeadings(body: string, noteSl: number, next: (sl: number) => string): string {
  if (!body.trim()) return ''
  const lines = body.split('\n')
  const fenceRe = /^\s*(```+|~~~+)/
  const headingRe = /^(#{1,6})\s+(.*)$/
  // Pass 1: collect authored heading levels (outside code fences) → contiguous ranks.
  let inFence = false
  const levels = new Set<number>()
  for (const line of lines) {
    if (fenceRe.test(line)) { inFence = !inFence; continue }
    if (inFence) continue
    const m = headingRe.exec(line)
    if (m) levels.add(m[1].length)
  }
  if (levels.size === 0) return body
  const rank = new Map([...levels].sort((a, b) => a - b).map((lv, i) => [lv, i]))
  // Pass 2: rewrite each heading line with its re-leveled depth + outline number.
  inFence = false
  return lines.map((line) => {
    if (fenceRe.test(line)) { inFence = !inFence; return line }
    const m = inFence ? null : headingRe.exec(line)
    if (!m) return line
    const sl = noteSl + 1 + rank.get(m[1].length)!
    return `${'#'.repeat(Math.min(1 + sl, 6))} ${next(sl)} ${m[2].trim()}`
  }).join('\n')
}

/**
 * Flatten the notes tree into ordered walkthrough sections, in mind-map (depth-first,
 * `sort_order`) order — what the walkthrough view renders.
 *
 * The root yields a heading-less intro section (its body verbatim, only if non-empty). Every
 * other note yields a heading whose level tracks mind-map depth (H2 for the root's direct
 * children, +1 per level deeper, clamped at H6) and a hierarchical `1.2.3.` number. Headings
 * the user typed inside a note body are also numbered and re-leveled to nest under that note
 * (they are not clickable). The numbering reflects only the walkthrough's heading hierarchy
 * and order — it is independent of the notes' own titles.
 */
export function flattenWalkthrough(root: NoteTreeNode): WalkthroughSection[] {
  const out: WalkthroughSection[] = []
  const next = outlineNumberer()
  // Root intro: verbatim body, no heading, not numbered.
  if (root.body.trim()) {
    out.push({ noteId: root.id, isRoot: true, level: 0, number: '', title: '', body: root.body })
  }
  const walk = (nodes: NoteTreeNode[], depth: number) => {
    for (const n of nodes) {
      const sl = depth + 1 // section level: top-level notes = 1
      const number = next(sl)
      // Body headings are numbered right after the note title and before its child notes,
      // so a note's own subsections and its child notes interleave in one outline.
      const body = numberBodyHeadings(n.body, sl, next)
      out.push({
        noteId: n.id,
        isRoot: false,
        level: Math.min(1 + sl, 6),
        number,
        title: n.title?.trim() || '(untitled)',
        body,
      })
      walk(n.children, depth + 1)
    }
  }
  walk(root.children, 0) // children are already sorted by sort_order in buildRootTree
  return out
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
  const notes = ref<Note[]>([]) // flat notes (root + descendants) for the current paper
  const currentPaperId = ref<number | null>(null)
  const loading = ref(false)

  // Front-end-only undo stack for drag reparent/reorder. Each entry is the note's
  // position BEFORE a move; cleared when a note is created (per the product spec).
  const moveHistory = ref<Array<{ noteId: number; parentId: number | null; sortOrder: number }>>([])

  /** The persisted root note, or null when it hasn't been created yet. */
  const root = computed<Note | null>(() => notes.value.find((n) => n.kind === 'root') ?? null)
  /** Single tree rooted at the (real or synthetic) root note. */
  const tree = computed<NoteTreeNode>(() => buildRootTree(notes.value, currentPaperId.value))
  /** A note counts only if its body (trimmed) is non-empty; an empty root doesn't count. */
  const noteCount = computed(() => notes.value.filter((n) => n.body.trim() !== '').length)

  async function fetchForPaper(paperId: number) {
    currentPaperId.value = paperId
    moveHistory.value = []
    loading.value = true
    try {
      const res = await notesApi.getForPaper(paperId)
      // Ignore late responses for a paper the user already navigated away from.
      if (currentPaperId.value !== paperId) return
      notes.value = res.notes
    } finally {
      loading.value = false
    }
  }

  /** Upsert the root note's body (lazily creating the root on first content). */
  async function saveRoot(body: string) {
    const paperId = currentPaperId.value
    if (paperId == null) return
    const res = await notesApi.saveRoot(paperId, body, root.value?.updated_at)
    const idx = notes.value.findIndex((n) => n.kind === 'root')
    if (idx !== -1) notes.value[idx] = res.data
    else notes.value.unshift(res.data)
    return res.data
  }

  async function createNote(data: { title?: string | null; body?: string; parent_id?: number | null }) {
    const paperId = currentPaperId.value
    if (paperId == null) return
    const hadRoot = root.value != null
    const res = await notesApi.create(paperId, data)
    if (hadRoot) {
      notes.value.push(res.data)
      moveHistory.value = [] // a new note invalidates the move-undo history
    } else {
      // The backend lazily created the root note too — refetch to pick up both rows.
      await fetchForPaper(paperId)
    }
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
  }

  return {
    notes, root, tree, noteCount, currentPaperId, loading, moveHistory,
    fetchForPaper, saveRoot, createNote, updateNote, moveNote, removeNote, undoMove,
  }
})
