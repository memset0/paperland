import { computed, ref, watch } from 'vue'

/**
 * A conversation tab. A thread is not stored anywhere: it is just the answer at its tail
 * (`entry_id` + `result_id`), and the ancestors are resolved from the follow-up tree when shown.
 * `entry_id: null` is a "new conversation" tab whose next question is a root question.
 */
export type ConversationTab = { entry_id: number; result_id: number } | { entry_id: null; result_id: null }

interface SavedState {
  tabs: ConversationTab[]
  active: number
}

/**
 * Paper-page layouts (wide screens): `split` = viewer | info & Q&A; `split-conv` = viewer (with
 * extra "Metadata" and "Q&A" viewer tabs) | conversation; `three` = viewer | info & Q&A | conversation.
 */
export type PaperLayout = 'split' | 'split-conv' | 'three'
type ConversationLayout = Exclude<PaperLayout, 'split'>

const LAYOUT_KEY = 'paperland_paper_layout'
const SPLIT_KEY = 'paperland_paper_split_left'
const THREE_KEY = 'paperland_paper_three'

// Column proportions are percentages of the split container (never px), so they come back the
// same after a reload at any window width. The limits keep every column usable.
const SPLIT_LEFT_MIN = 20
const SPLIT_LEFT_MAX = 80
const THREE_LEFT_MIN = 15
const THREE_CONV_MIN = 22
const THREE_MIDDLE_MIN = 25
const SPLIT_DEFAULT = 45
const THREE_DEFAULT = { left: 36, conv: 30 }

function readJSON(key: string): any {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* localStorage unavailable */ }
}

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)) }
function round1(value: number) { return Math.round(value * 10) / 10 }

/** Clamp the split left column % (shared by `split` and `split-conv`). */
export function clampSplitLeft(value: number) { return clamp(value, SPLIT_LEFT_MIN, SPLIT_LEFT_MAX) }

/**
 * Clamp three-column proportions so every column keeps its minimum share. `fixed` is the side the
 * user is dragging: it wins, and the other side gives way.
 */
export function clampThree(left: number, conv: number, fixed: 'left' | 'conv' = 'left') {
  if (fixed === 'left') {
    left = clamp(left, THREE_LEFT_MIN, 100 - THREE_CONV_MIN - THREE_MIDDLE_MIN)
    conv = clamp(conv, THREE_CONV_MIN, 100 - left - THREE_MIDDLE_MIN)
  } else {
    conv = clamp(conv, THREE_CONV_MIN, 100 - THREE_LEFT_MIN - THREE_MIDDLE_MIN)
    left = clamp(left, THREE_LEFT_MIN, 100 - conv - THREE_MIDDLE_MIN)
  }
  return { left, conv }
}

function readLayout(): { layout: PaperLayout; last: ConversationLayout } {
  const saved = readJSON(LAYOUT_KEY)
  const layout = saved?.layout === 'split-conv' || saved?.layout === 'three' ? saved.layout : 'split'
  return { layout, last: saved?.last === 'three' ? 'three' : 'split-conv' }
}

function readSplitLeft(): number {
  const value = Number(readJSON(SPLIT_KEY))
  return Number.isFinite(value) && value > 0 ? clampSplitLeft(value) : SPLIT_DEFAULT
}

function readThree(): { left: number; conv: number } {
  const saved = readJSON(THREE_KEY)
  const left = Number(saved?.left), conv = Number(saved?.conv)
  if (!Number.isFinite(left) || !Number.isFinite(conv)) return { ...THREE_DEFAULT }
  return clampThree(left, conv)
}

// Module-level singleton: one conversation view per paper page.
const boundKey = ref<string | null>(null)
const savedLayout = readLayout()
const layout = ref<PaperLayout>(savedLayout.layout)
const lastConversationLayout = ref<ConversationLayout>(savedLayout.last)
const splitLeft = ref(readSplitLeft())
const three = ref(readThree())
const tabs = ref<ConversationTab[]>([])
const active = ref(0)
/** Set by the paper page: the view exists only on the wide split layout for logged-in users. */
const available = ref(false)
/**
 * Bumped when a Q&A entry is about to be revealed; in the `split-conv` layout the info & Q&A
 * column lives in a viewer tab, which then activates so the entry is in the DOM.
 */
export const paperInfoRequests = ref(0)
export function requestPaperInfo() { paperInfoRequests.value++ }
let restoring = false

function storageKey(key: string) { return `paperland_qa_conv_${key}` }

function readState(key: string): SavedState | null {
  try {
    const raw = localStorage.getItem(storageKey(key))
    if (!raw) return null
    const state = JSON.parse(raw)
    if (!Array.isArray(state?.tabs)) return null
    const valid = state.tabs.filter((tab: any) =>
      (tab?.entry_id === null && tab?.result_id === null)
      || (Number.isInteger(tab?.entry_id) && Number.isInteger(tab?.result_id)))
    return { tabs: valid, active: Number.isInteger(state.active) ? state.active : 0 }
  } catch {
    return null
  }
}

function writeState() {
  if (!boundKey.value || restoring) return
  try {
    localStorage.setItem(storageKey(boundKey.value), JSON.stringify({ tabs: tabs.value, active: active.value }))
  } catch {
    // localStorage unavailable — tabs just won't survive a reload
  }
}

watch([tabs, active], writeState, { deep: true })
watch([layout, lastConversationLayout], () => writeJSON(LAYOUT_KEY, { layout: layout.value, last: lastConversationLayout.value }))
watch(splitLeft, (value) => writeJSON(SPLIT_KEY, round1(value)))
watch(three, (value) => writeJSON(THREE_KEY, { left: round1(value.left), conv: round1(value.conv) }), { deep: true })

/** The conversation view is part of both conversation layouts. */
const open = computed(() => layout.value !== 'split')

function sameTail(tab: ConversationTab, entryId: number, resultId: number) {
  return tab.entry_id === entryId && tab.result_id === resultId
}

/** Paper-page layout (which columns, their proportions) and the conversation view's thread tabs. */
export function useQAConversation() {
  /** The view is shown only when it is both available on this layout and switched on. */
  const visible = computed(() => available.value && open.value)
  const activeTab = computed<ConversationTab | null>(() => tabs.value[active.value] ?? null)

  /** Bind the tabs to a user + paper, restoring saved tabs. */
  function bind(userId: number | null | undefined, paperId: number) {
    const key = `${userId ?? 'anon'}_${paperId}`
    if (boundKey.value === key) return
    restoring = true
    boundKey.value = key
    const state = readState(key)
    tabs.value = state?.tabs ?? []
    active.value = Math.min(Math.max(0, state?.active ?? 0), Math.max(0, tabs.value.length - 1))
    restoring = false
  }

  function setAvailable(value: boolean) { available.value = value }

  function setLayout(value: PaperLayout) {
    if (value !== 'split' && tabs.value.length === 0) newTab()
    layout.value = value
    if (value !== 'split') lastConversationLayout.value = value
  }

  /** Show the conversation view: switch to the most recently used conversation layout. */
  function show() {
    if (tabs.value.length === 0) newTab()
    if (layout.value === 'split') setLayout(lastConversationLayout.value)
  }

  /** Hide the conversation view: back to the plain split layout. */
  function hide() { layout.value = 'split' }

  function toggle() {
    if (open.value) hide()
    else show()
  }

  /** Open (or activate) the thread ending at an answer, and show the view. */
  function openThread(entryId: number, resultId: number) {
    const existing = tabs.value.findIndex((tab) => sameTail(tab, entryId, resultId))
    if (existing >= 0) {
      active.value = existing
    } else {
      // Reuse an empty "new conversation" tab rather than piling up blank tabs.
      const blank = activeTab.value?.entry_id === null ? active.value : -1
      if (blank >= 0) {
        tabs.value[blank] = { entry_id: entryId, result_id: resultId }
      } else {
        tabs.value = [...tabs.value, { entry_id: entryId, result_id: resultId }]
        active.value = tabs.value.length - 1
      }
    }
    show()
  }

  function newTab() {
    const blank = tabs.value.findIndex((tab) => tab.entry_id === null)
    if (blank >= 0) { active.value = blank; return }
    tabs.value = [...tabs.value, { entry_id: null, result_id: null }]
    active.value = tabs.value.length - 1
  }

  /** Close a tab; closing the last one starts a fresh "new conversation" tab (the layout stays). */
  function closeTab(index: number) {
    tabs.value = tabs.value.filter((_, i) => i !== index)
    if (active.value >= index && active.value > 0) active.value -= 1
    if (tabs.value.length === 0) newTab()
  }

  /** After asking in the active tab: its thread now ends at the new answer. */
  function setActiveTail(entryId: number, resultId: number) {
    if (!activeTab.value) { openThread(entryId, resultId); return }
    tabs.value[active.value] = { entry_id: entryId, result_id: resultId }
  }

  return {
    open, layout, splitLeft, three, tabs, active, available, visible, activeTab,
    bind, setAvailable, setLayout, show, hide, toggle, openThread, newTab, closeTab, setActiveTail,
  }
}
