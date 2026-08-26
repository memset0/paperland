import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import { notesApi } from '@/api/client'
import { useWindowsStore } from '@/stores/windows'
import { useQAStore } from '@/stores/qa'
import type { Note, NoteDocTree, NoteSection } from '@paperland/shared'
import {
  parseNoteDoc, flattenSections, findSection, structureKey as mdStructureKey,
  sectionBaseline as mdSectionBaseline, reparentSection, insertChild, insertSibling,
  deleteSection, renameSection, replaceLeafBody, replacePreamble,
} from '@/lib/markdown-doc'

export type PanelMode = 'render' | 'edit' | 'split'

/**
 * The single note document for the current (user, paper). The canonical state is one Markdown
 * string (`body`); the mind-map and walkthrough are derived from its headings via `tree`. All
 * editing surfaces write through to this one string (no private snapshots); persistence is a
 * single debounced whole-document PUT with optimistic `updated_at`. Structural edits (reparent /
 * add / delete / rename) snapshot for undo and close all floating windows.
 */
export const useNotesStore = defineStore('notes', () => {
  const currentPaperId = ref<number | null>(null)
  const body = ref('')
  const noteRow = ref<Note | null>(null)
  const loading = ref(false)
  const panelMode = ref<PanelMode>('render')
  const undoStack = ref<string[]>([])
  const windowsStore = useWindowsStore()
  const qaStore = useQAStore()

  const tree = computed<NoteDocTree>(() => parseNoteDoc(body.value))
  const canUndo = computed(() => undoStack.value.length > 0)
  /** Whether the whole-document floating editor is open for the current paper. */
  const docWindowOpen = computed(() => {
    const id = currentPaperId.value
    return id != null && windowsStore.windows.some((w) => w.paperId === id && w.kind === 'doc')
  })
  /** Whether the user marked this note's reading complete. */
  const completed = computed(() => noteRow.value?.completed === true)
  /** Whether this note is published (readable by anyone). */
  const isPublic = computed(() => noteRow.value?.is_public === true)
  /** Shareable deep-link to this note (empty until the note row + paper exist). */
  const shareLink = computed(() => {
    const id = noteRow.value?.id
    const pid = currentPaperId.value
    if (id == null || pid == null) return ''
    return `${window.location.origin}/papers/${pid}?note=${id}`
  })
  /** Count of nodes (sections + the preamble/center) whose content is non-empty after trimming. */
  const noteCount = computed(() => {
    const sections = flattenSections(tree.value).filter((s) => s.leafBody.trim() !== '').length
    return sections + (tree.value.preamble.trim() !== '' ? 1 : 0)
  })

  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let savingInFlight = false
  let saveAgain = false

  function clearTimer() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null } }

  function scheduleSave() {
    clearTimer()
    saveTimer = setTimeout(flushSave, 1500)
  }

  async function flushSave() {
    clearTimer()
    const paperId = currentPaperId.value
    if (paperId == null) return
    if (savingInFlight) { saveAgain = true; return }
    savingInFlight = true
    try {
      const res = await notesApi.save(paperId, body.value, noteRow.value?.updated_at)
      if (currentPaperId.value !== paperId) return // navigated away
      if (res.ok) {
        noteRow.value = res.data
        if (qaStore.currentPaperId === paperId) void qaStore.fetchQA(paperId)
      } else {
        // Conflict (another tab/device). Reload the latest and drop windows (structure may differ).
        noteRow.value = res.data
        body.value = res.data.body
        useWindowsStore().closeForPaper(paperId)
        toast.error('Note was modified elsewhere — reloaded the latest version.')
      }
    } finally {
      savingInFlight = false
      if (saveAgain) { saveAgain = false; scheduleSave() }
    }
  }

  async function fetchForPaper(paperId: number) {
    currentPaperId.value = paperId
    undoStack.value = []
    panelMode.value = 'render'
    loading.value = true
    try {
      const res = await notesApi.getForPaper(paperId)
      if (currentPaperId.value !== paperId) return
      noteRow.value = res.note
      body.value = res.note?.body ?? ''
    } finally {
      loading.value = false
    }
  }

  function closeWindows() {
    if (currentPaperId.value != null) useWindowsStore().closeForPaper(currentPaperId.value)
  }

  // ── Whole-document editing (edit / split mode) ──
  function setBody(next: string) {
    body.value = next
    scheduleSave()
  }

  function setPanelMode(mode: PanelMode) {
    // The left panel is locked to render while the whole-document editor is open.
    if (docWindowOpen.value && mode !== 'render') return
    // Entering full-document editing closes floating windows (mutually-exclusive contexts).
    if (mode !== 'render') closeWindows()
    panelMode.value = mode
  }

  /** Open the whole-document floating editor: lock the left panel to render; the windows store
   *  closes any section windows (mutual exclusion). */
  function openDocEditor() {
    const paperId = currentPaperId.value
    if (paperId == null) return
    panelMode.value = 'render'
    windowsStore.open({ paperId, kind: 'doc', sectionId: null, title: 'Note' })
  }

  /** Mark the note's reading complete (or not). No-op when completing an empty note. */
  async function toggleCompleted(next: boolean) {
    const paperId = currentPaperId.value
    if (paperId == null) return
    if (next && body.value.trim() === '') return
    const res = await notesApi.setCompleted(paperId, next)
    if (currentPaperId.value === paperId && res?.data) noteRow.value = res.data
  }

  /** Publish / unpublish this note. No-op when publishing an empty note. */
  async function setPublic(next: boolean) {
    const paperId = currentPaperId.value
    if (paperId == null) return
    if (next && body.value.trim() === '') return
    const res = await notesApi.setVisibility(paperId, next)
    if (currentPaperId.value === paperId && res?.data) noteRow.value = res.data
  }

  // ── Leaf editing (floating windows) ──
  /** Replace a section's leaf body (window edits write through here). Returns false if gone. */
  function updateLeaf(sectionId: string, leafText: string): boolean {
    const next = replaceLeafBody(body.value, sectionId, leafText)
    if (next == null) return false
    body.value = next
    scheduleSave()
    return true
  }
  /** Replace the preamble (center-node window). */
  function updatePreamble(text: string) {
    body.value = replacePreamble(body.value, text)
    scheduleSave()
  }

  // ── Structural edits (mind-map): snapshot for undo + close windows ──
  function applyStructural(next: string | null): boolean {
    if (next == null) return false
    undoStack.value.push(body.value)
    body.value = next
    closeWindows()
    scheduleSave()
    return true
  }

  function reparent(sectionId: string, newParentId: string | null): boolean {
    return applyStructural(reparentSection(body.value, sectionId, newParentId))
  }
  function remove(sectionId: string): boolean {
    return applyStructural(deleteSection(body.value, sectionId))
  }
  function rename(sectionId: string, heading: string): boolean {
    return applyStructural(renameSection(body.value, sectionId, heading))
  }

  /** Add a child section and return the new section's id (for opening its editor), or null. */
  function addChild(parentId: string | null, heading: string): string | null {
    const next = insertChild(body.value, parentId, heading)
    if (!applyStructural(next)) return null
    return locateInserted(parentId, heading)
  }
  /** Add a sibling after `sectionId`; returns the new section's id, or null. */
  function addSibling(sectionId: string, heading: string): string | null {
    const parentId = parentOf(sectionId)
    const next = insertSibling(body.value, sectionId, heading)
    if (next == null || !applyStructural(next)) return null
    return locateInserted(parentId, heading)
  }

  /** Locate a freshly-inserted section by heading among the target's children (last match). */
  function locateInserted(parentId: string | null, heading: string): string | null {
    const list = parentId == null ? tree.value.sections : (findSection(tree.value, parentId)?.children ?? [])
    const matches = list.filter((s) => s.heading === heading.trim())
    return matches.length ? matches[matches.length - 1].id : null
  }

  function parentOf(sectionId: string): string | null {
    const dot = sectionId.lastIndexOf('.')
    return dot === -1 ? null : sectionId.slice(0, dot)
  }

  function undo() {
    if (!undoStack.value.length) return
    body.value = undoStack.value.pop()!
    closeWindows()
    scheduleSave()
  }

  // ── Window-binding helpers (concurrency guard, design D7) ──
  function structureKey(): string { return mdStructureKey(tree.value) }
  function sectionBaseline(sectionId: string): string | null { return mdSectionBaseline(tree.value, sectionId) }
  function getSection(sectionId: string): NoteSection | null { return findSection(tree.value, sectionId) }

  return {
    // state
    currentPaperId, body, noteRow, loading, panelMode, undoStack,
    // computed
    tree, noteCount, canUndo, docWindowOpen, completed, isPublic, shareLink,
    // actions
    fetchForPaper, setBody, setPanelMode, openDocEditor, toggleCompleted, setPublic, updateLeaf, updatePreamble,
    reparent, remove, rename, addChild, addSibling, undo,
    structureKey, sectionBaseline, getSection,
  }
})
