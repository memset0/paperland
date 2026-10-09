import { ref, watch } from 'vue'
import type { QAImageInput, QAInput, QAInputRequest, QATextSelectionInput, QATreeNode } from '@paperland/shared'
import { api } from '@/api/client'

/** A passage or screenshot attached to the question box, with its chain-unique label. */
export type ComposerAttachment = QATextSelectionInput | QAImageInput
type ContentInput = QATextSelectionInput | QAImageInput

/** The specific answer a follow-up continues from. */
export interface ComposerFollowup {
  result_id: number
  entry_id: number
  title: string
  model_name: string
  /** Inputs of the whole ancestor chain (root … the followed entry), referenceable by label. */
  ancestor_inputs: ContentInput[]
}

interface Draft {
  question: string
  attachments: ComposerAttachment[]
  followup: ComposerFollowup | null
}

const LABEL_PREFIX = { text_selection: 'Quote', image: 'Image' } as const

// Module-level singleton: one question box per page, shared by the PDF viewer (adds
// attachments), answers (start follow-ups), and the QAInput panel (edits and submits).
const boundKey = ref<string | null>(null)
const question = ref('')
const attachments = ref<ComposerAttachment[]>([])
const followup = ref<ComposerFollowup | null>(null)
/** Incremented whenever something asks for the question box to be opened. */
const openRequests = ref(0)
let insertAtCursor: ((text: string) => void) | null = null
let restoring = false

function storageKey(key: string) { return `paperland_qa_draft_${key}` }

function readDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(storageKey(key))
    if (!raw) return null
    const draft = JSON.parse(raw)
    if (typeof draft?.question !== 'string' || !Array.isArray(draft?.attachments)) return null
    return { question: draft.question, attachments: draft.attachments, followup: draft.followup ?? null }
  } catch {
    return null
  }
}

function writeDraft() {
  if (!boundKey.value || restoring) return
  try {
    const empty = !question.value && attachments.value.length === 0 && !followup.value
    if (empty) localStorage.removeItem(storageKey(boundKey.value))
    else localStorage.setItem(storageKey(boundKey.value), JSON.stringify({
      question: question.value, attachments: attachments.value, followup: followup.value,
    }))
  } catch {
    // localStorage unavailable — the draft just won't survive a reload
  }
}

watch([question, attachments, followup], writeDraft, { deep: true })

/** Highest number already used for a label kind across the follow-up chain and the draft. */
function maxLabel(kind: ContentInput['kind']): number {
  const used = [...(followup.value?.ancestor_inputs ?? []), ...attachments.value]
  let max = 0
  for (const input of used) {
    if (input.kind !== kind) continue
    const match = new RegExp(`^${LABEL_PREFIX[kind]}(\\d+)$`).exec(input.label)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return max
}

/** Content inputs along the path root → entry in a follow-up tree (hidden nodes contribute none). */
function pathInputs(node: QATreeNode, entryId: number): ContentInput[] | null {
  const own = (node.entry?.inputs ?? []).filter((input: QAInput): input is ContentInput => input.kind !== 'history')
  if (node.entry_id === entryId) return own
  for (const child of node.children) {
    const below = pathInputs(child, entryId)
    if (below) return [...own, ...below]
  }
  return null
}

export function useQAComposer() {
  /** Bind the draft to a user + paper, restoring any saved draft (or clearing for a new one). */
  function bind(userId: number | null | undefined, paperId: number) {
    const key = `${userId ?? 'anon'}_${paperId}`
    if (boundKey.value === key) return
    restoring = true
    boundKey.value = key
    const draft = readDraft(key)
    question.value = draft?.question ?? ''
    attachments.value = draft?.attachments ?? []
    followup.value = draft?.followup ?? null
    restoring = false
  }

  function registerInserter(fn: ((text: string) => void) | null) { insertAtCursor = fn }

  function insertToken(token: string) {
    if (insertAtCursor) insertAtCursor(token)
    else question.value = `${question.value}${question.value && !/\s$/.test(question.value) ? ' ' : ''}${token}`
  }

  function requestOpen() { openRequests.value += 1 }

  /** Add a passage/screenshot (already uploaded to the image host) and insert its token. */
  function addAttachment(input: Omit<QATextSelectionInput, 'label'> | Omit<QAImageInput, 'label'>): ComposerAttachment {
    const label = `${LABEL_PREFIX[input.kind]}${maxLabel(input.kind) + 1}`
    const attachment = { ...input, label } as ComposerAttachment
    attachments.value = [...attachments.value, attachment]
    insertToken(`@${label} `)
    requestOpen()
    return attachment
  }

  /** Remove an attachment and its tokens; other labels keep their numbers. */
  function removeAttachment(label: string) {
    attachments.value = attachments.value.filter((input) => input.label !== label)
    question.value = question.value.replace(new RegExp(`@${label}\\b ?`, 'g'), '')
  }

  /** Continue a specific completed answer; optionally pre-fill the question (#moonlight links). */
  async function startFollowup(target: Omit<ComposerFollowup, 'ancestor_inputs'>, prefill?: string) {
    let ancestors: ContentInput[] = []
    try {
      const tree = await api.get<{ data: QATreeNode }>(`/api/qa/entries/${target.entry_id}/tree`)
      ancestors = pathInputs(tree.data, target.entry_id) ?? []
    } catch {
      // Labels are still re-checked by the backend; only the @ menu loses ancestor items.
    }
    followup.value = { ...target, ancestor_inputs: ancestors }
    if (prefill != null) question.value = prefill
    requestOpen()
  }

  function clearFollowup() { followup.value = null }

  /** Inputs that can be referenced with `@Label` right now (ancestors first). */
  function referenceables(): ContentInput[] {
    return [...(followup.value?.ancestor_inputs ?? []), ...attachments.value]
  }

  /** Request payload inputs: the history reference plus this round's attachments. */
  function requestInputs(): QAInputRequest[] {
    return [
      ...(followup.value ? [{ kind: 'history' as const, result_id: followup.value.result_id }] : []),
      ...attachments.value,
    ]
  }

  function hasImage(): boolean {
    return referenceables().some((input) => input.kind === 'image')
  }

  function reset() {
    question.value = ''
    attachments.value = []
    followup.value = null
  }

  return {
    question, attachments, followup, openRequests,
    bind, registerInserter, insertToken, requestOpen, addAttachment, removeAttachment,
    startFollowup, clearFollowup, referenceables, requestInputs, hasImage, reset,
  }
}

/** Short human page label for an input, e.g. `p.3` / `p.3–4`. */
export function inputPageLabel(input: ContentInput): string | null {
  if (input.kind === 'image') return input.pdf ? `p.${input.pdf.page}` : null
  const pages = [...new Set(input.pdf.map((segment) => segment.page))].sort((a, b) => a - b)
  if (pages.length === 0) return null
  return pages.length === 1 ? `p.${pages[0]}` : `p.${pages[0]}–${pages[pages.length - 1]}`
}
