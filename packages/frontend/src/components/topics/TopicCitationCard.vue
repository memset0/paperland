<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { BookOpen, Check, Download, ExternalLink, Loader2 } from '@lucide/vue'
import type { TopicDetail } from '@paperland/shared'
import { normalizeCiteId, s2Url } from '@/lib/cite-links'
import PaperCitationCard from '@/components/PaperCitationCard.vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'

const props = defineProps<{ detail: TopicDetail; host: HTMLElement | null; documentKey: string; disabled: boolean; busy: string; imported: Set<string>; errors: Record<string, string> }>()
const emit = defineEmits<{ import: [entryId: string]; locate: [number: number] }>()
const anchor = shallowRef<HTMLElement | null>(null), number = ref<number | null>(null), panel = ref<HTMLElement | null>(null)
const hovered = ref(false)
const pinned = ref(false)
const entry = computed(() => props.detail.snapshot.list.papers.find((p) => props.detail.reference_numbers[p.id] === number.value))
const paperId = computed(() => entry.value ? props.detail.paper_bindings[entry.value.id] : null)
const added = computed(() => !!entry.value && (props.detail.paper_in_library[entry.value.id] || props.imported.has(entry.value.id)))
const importable = computed(() => !!entry.value && (props.detail.paper_importable?.[entry.value.id] ?? (!!entry.value.s2_id || !!paperId.value)))
const source = computed(() => entry.value?.s2_id ? s2Url(normalizeCiteId(entry.value.s2_id) ?? entry.value.s2_id) : entry.value?.url)
const error = computed(() => entry.value ? props.errors[entry.value.id] : '')
const cardId = computed(() => `topic-reference-card-${props.detail.id}`)
const isOpen = computed(() => !!entry.value && !!anchor.value?.isConnected)
let closeTimer: ReturnType<typeof setTimeout> | undefined

function cancelClose() { if (closeTimer) clearTimeout(closeTimer); closeTimer = undefined }
function close() {
  cancelClose(); anchor.value?.setAttribute('aria-expanded', 'false')
  number.value = null; anchor.value = null; hovered.value = false; pinned.value = false
}
function scheduleClose() {
  cancelClose()
  closeTimer = setTimeout(() => {
    const active = document.activeElement
    if (!pinned.value && !hovered.value && active !== anchor.value && !panel.value?.contains(active)) close()
  }, 180)
}
function open(element: HTMLElement, keepOpen = false): boolean {
  if (props.disabled || !element.closest('.topic-document')) return false
  const n = Number(element.getAttribute('href')?.match(/^#ref:(\d+)$/)?.[1])
  if (!props.detail.snapshot.list.papers.some((p) => props.detail.reference_numbers[p.id] === n)) return false
  cancelClose(); if (anchor.value !== element) pinned.value = keepOpen; else if (keepOpen) pinned.value = true
  anchor.value?.setAttribute('aria-expanded', 'false')
  anchor.value = element; number.value = n; element.setAttribute('aria-expanded', 'true'); element.setAttribute('aria-controls', cardId.value)
  return true
}
function targetOf(event: Event): HTMLElement | null { return (event.target as Element)?.closest?.('.topic-document a[href^="#ref:"]') ?? null }
function onOver(event: Event) { const target = targetOf(event); if (target) open(target) }
function onOut(event: Event) {
  const target = targetOf(event)
  if (target === anchor.value && !((event as MouseEvent).relatedTarget instanceof Node && target?.contains((event as MouseEvent).relatedTarget as Node))) scheduleClose()
}
function onFocusOut(event: Event) { if (targetOf(event) === anchor.value) scheduleClose() }
function onKey(event: Event) {
  const key = (event as KeyboardEvent).key, target = targetOf(event)
  if (key === 'Escape') close()
  else if (key === 'ArrowDown' && target && open(target)) {
    event.preventDefault()
    void nextTick(() => panel.value?.querySelector<HTMLElement>('a,button:not(:disabled)')?.focus())
  }
}
function onOutside(event: Event) {
  const original = (event as CustomEvent<{ originalEvent: Event }>).detail?.originalEvent
  const target = original ? targetOf(original) : null
  const n = Number(target?.getAttribute('href')?.match(/^#ref:(\d+)$/)?.[1])
  if (target && props.detail.snapshot.list.papers.some((p) => props.detail.reference_numbers[p.id] === n)) event.preventDefault()
}
function locate() { const n = number.value; close(); if (n != null) emit('locate', n) }
watch(() => props.documentKey, close)
watch(() => props.disabled, (disabled) => { if (disabled) close() })
watch(() => props.host, (host, old) => {
  for (const [name, listener] of [['mouseover', onOver], ['mouseout', onOut], ['focusin', onOver], ['focusout', onFocusOut], ['keydown', onKey]] as const) {
    old?.removeEventListener(name, listener); host?.addEventListener(name, listener)
  }
}, { immediate: true, flush: 'post' })
onBeforeUnmount(() => {
  close()
  for (const [name, listener] of [['mouseover', onOver], ['mouseout', onOut], ['focusin', onOver], ['focusout', onFocusOut], ['keydown', onKey]] as const) props.host?.removeEventListener(name, listener)
})
defineExpose({ open, close })
</script>

<template>
  <Popover :open="isOpen" @update:open="(value) => { if (!value) close() }">
    <PopoverAnchor v-if="anchor" :reference="anchor" />
    <PopoverContent v-if="entry" :id="cardId" align="start" :side-offset="8" :collision-padding="12" hide-when-detached class="topic-citation-popover max-h-[70dvh] w-80 max-w-[calc(100vw-24px)] overflow-y-auto p-4" :aria-label="`Reference ${number} details`" @open-auto-focus.prevent @close-auto-focus.prevent @interact-outside="onOutside" @pointerdown="pinned = true" @mouseenter="hovered = true; cancelClose()" @mouseleave="hovered = false; scheduleClose()" @focusin="cancelClose" @focusout="scheduleClose">
      <div ref="panel">
        <p class="mb-2 text-[11px] font-medium text-muted-foreground">Reference {{ number }}</p>
        <PaperCitationCard :title="entry.title" :authors="entry.authors ?? entry.citation?.author ?? []" :year="entry.year ?? entry.citation?.year" :venue="entry.citation?.howpublished">
          <Badge v-if="entry.verification === 'unverified'" variant="outline" class="mt-2">Unverified</Badge>
          <p v-if="error" role="alert" class="mt-3 text-xs text-destructive">{{ error }}</p>
          <template #actions>
            <RouterLink v-if="paperId" :to="`/papers/${paperId}`" class="text-xs"><BookOpen class="size-3.5" />Open paper</RouterLink>
            <a v-if="source" :href="source" target="_blank" rel="noopener noreferrer" class="text-xs"><ExternalLink class="size-3.5" />{{ entry.s2_id ? 'Semantic Scholar' : 'Source' }}</a>
            <Button v-if="importable" variant="outline" size="sm" :disabled="!!busy || added" @click="emit('import', entry.id)"><Loader2 v-if="busy === `import:${entry.id}`" class="animate-spin" /><Check v-else-if="added" /><Download v-else />{{ added ? 'Added to my list' : busy === `import:${entry.id}` ? 'Importing…' : error ? 'Try import again' : paperId ? 'Add to my list' : 'Import paper' }}</Button>
            <Button variant="ghost" size="xs" @click="locate">View reference</Button>
          </template>
        </PaperCitationCard>
      </div>
    </PopoverContent>
  </Popover>
</template>
