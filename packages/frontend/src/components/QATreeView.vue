<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { QAResult } from '@paperland/shared'
import { useQAStore } from '@/stores/qa'
import { usePapersStore } from '@/stores/papers'
import { useQAConversation } from '@/composables/useQAConversation'
import { useBlockAnchor } from '@/composables/useBlockAnchor'
import { compareQAResultsNewestFirst } from '@/lib/qa-result-selection'
import QATreeNode, { type QATreeItem } from './QATreeNode.vue'

// Mind map of the paper's visible Q&As (current mine/all scope). A follow-up is drawn under its
// parent *question*; which of the parent's answers it continued does not matter here. Entries whose
// parent isn't loaded become roots. Clicking a node opens its thread in the conversation view.
const props = defineProps<{ paperId: number }>()
const store = useQAStore()
const papers = usePapersStore()
const conversation = useQAConversation()
const { revealQAEntry } = useBlockAnchor()

interface Flat {
  entryId: number
  label: string
  status: string
  isTemplate: boolean
  entryKey: string
  parentEntryId: number | null
  results: QAResult[]
}

const flat = computed<Flat[]>(() => {
  const items: Flat[] = []
  for (const tmpl of store.templates) {
    const entry = store.qaData.template[tmpl.name]
    if (!entry || !entry.entry_id) continue
    items.push({
      entryId: entry.entry_id, label: tmpl.prompt, status: entry.status, isTemplate: true,
      entryKey: `tmpl-${tmpl.name}`, parentEntryId: entry.parent_entry_id, results: entry.results,
    })
  }
  // Oldest first so siblings read in asking order.
  for (const entry of [...store.qaData.free].reverse()) {
    items.push({
      entryId: entry.entry_id, label: entry.prompt || 'Free question', status: entry.status, isTemplate: false,
      entryKey: `free-${entry.entry_id}`, parentEntryId: entry.parent_entry_id, results: entry.results,
    })
  }
  return items
})

const CENTER_ID = '__qa_center__'
const root = computed<QATreeItem>(() => {
  const byId = new Map(flat.value.map((item) => [item.entryId, item]))
  const children = new Map<number | null, Flat[]>()
  for (const item of flat.value) {
    const parent = item.parentEntryId != null && byId.has(item.parentEntryId) ? item.parentEntryId : null
    children.set(parent, [...(children.get(parent) ?? []), item])
  }
  const build = (item: Flat, seen: Set<number>): QATreeItem => ({
    id: `qa-${item.entryId}`,
    entryId: item.entryId,
    label: item.label,
    status: item.status,
    isCenter: false,
    isTemplate: item.isTemplate,
    answerCount: item.results.length,
    children: seen.has(item.entryId) ? [] : (children.get(item.entryId) ?? []).map((child) => build(child, new Set([...seen, item.entryId]))),
  })
  return {
    id: CENTER_ID, entryId: null, label: papers.currentPaper?.title ?? 'Paper', status: '', isCenter: true,
    isTemplate: false, answerCount: 0, children: (children.get(null) ?? []).map((item) => build(item, new Set())),
  }
})

/** The answer a node opens: the pinned model's answer, else the most recently requested one. */
function preferredResult(item: Flat): QAResult | null {
  if (!item.results.length) return null
  let pinned: string | null = null
  try { pinned = localStorage.getItem(`qa-pin-${props.paperId}-${item.entryKey}`) } catch { /* ignore */ }
  return item.results.find((result) => result.model_name === pinned)
    ?? [...item.results].sort(compareQAResultsNewestFirst)[0]
}

function onSelect(entryId: number) {
  const item = flat.value.find((candidate) => candidate.entryId === entryId)
  if (!item) return
  const result = preferredResult(item)
  if (result && conversation.available.value) conversation.openThread(entryId, result.id)
  else void revealQAEntry(entryId, result?.id ?? null)
}

// --- Connectors: SVG curves measured from the rendered node boxes ---
const innerRef = ref<HTMLElement | null>(null)
const edges = ref<string[]>([])
let ro: ResizeObserver | null = null

function recompute() {
  const inner = innerRef.value
  if (!inner) { edges.value = []; return }
  const irect = inner.getBoundingClientRect()
  const paths: string[] = []
  const walk = (node: QATreeItem) => {
    for (const child of node.children) {
      const parentEl = inner.querySelector<HTMLElement>(`[data-nid="${node.id}"]`)
      const childEl = inner.querySelector<HTMLElement>(`[data-nid="${child.id}"]`)
      if (parentEl && childEl) {
        const pr = parentEl.getBoundingClientRect()
        const cr = childEl.getBoundingClientRect()
        const px = pr.right - irect.left
        const py = pr.top + pr.height / 2 - irect.top
        const cx = cr.left - irect.left
        const cy = cr.top + cr.height / 2 - irect.top
        const mx = px + Math.max(12, (cx - px) / 2)
        paths.push(`M ${px} ${py} C ${mx} ${py} ${mx} ${cy} ${cx} ${cy}`)
      }
      walk(child)
    }
  }
  walk(root.value)
  edges.value = paths
}

onMounted(() => {
  nextTick(recompute)
  if (innerRef.value) {
    ro = new ResizeObserver(() => recompute())
    ro.observe(innerRef.value)
  }
})
onUnmounted(() => ro?.disconnect())
watch(root, () => nextTick(recompute), { deep: true })
</script>

<template>
  <div class="qt-canvas">
    <p v-if="!root.children.length" class="py-6 text-center text-xs text-muted-foreground">No Q&A yet</p>
    <div v-show="root.children.length" ref="innerRef" class="qt-inner">
      <svg class="qt-links">
        <path v-for="(d, i) in edges" :key="i" :d="d" fill="none" stroke="var(--border)" stroke-width="1.5" />
      </svg>
      <div class="qt-nodes">
        <QATreeNode :node="root" @select="onSelect" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.qt-canvas { padding: 12px; }
.qt-inner { position: relative; width: max-content; min-width: 100%; }
.qt-links { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: visible; }
.qt-nodes { position: relative; z-index: 1; }
</style>
