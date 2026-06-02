<script setup lang="ts">
import { ref, reactive, watch, nextTick, onMounted } from 'vue'
import { notesApi } from '@/api/client'
import type { PublicNoteSummary, NoteWithAuthor } from '@paperland/shared'
import PublicNoteView from './PublicNoteView.vue'
import { requestedPublicNote } from '@/composables/usePublicNoteOpen'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronRight, Users, Loader2 } from '@lucide/vue'

// Right-panel "Public notes from others" section. Lists OTHER users' public notes for the paper
// (the server already excludes the caller's own + private notes). Each entry is collapsed and its
// body UNFETCHED until first expand; expanding lazily fetches the full note and renders it
// read-only (mind-map → body) via PublicNoteView. A `?note=` deep link drives a specific entry open.
const props = defineProps<{ paperId: number }>()

const list = ref<PublicNoteSummary[]>([])
const open = reactive<Record<number, boolean>>({})
// Lazy body cache, keyed by note id: 'loading' while fetching, then the note (or 'error').
const bodies = reactive<Record<number, 'loading' | 'error' | NoteWithAuthor>>({})
const entryEls: Record<number, HTMLElement | null> = {}

function setEntryEl(id: number, el: unknown) {
  const dom = (el as { $el?: unknown })?.$el ?? el
  entryEls[id] = dom instanceof HTMLElement ? dom : null
}

async function loadList() {
  list.value = (await notesApi.listPublicForPaper(props.paperId)).data
}

async function fetchBody(id: number) {
  if (bodies[id] && bodies[id] !== 'error') return
  bodies[id] = 'loading'
  const note = await notesApi.getById(id)
  bodies[id] = note ?? 'error'
}

function onToggle(id: number, isOpen: boolean) {
  open[id] = isOpen
  if (isOpen) fetchBody(id)
}

function fmt(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString()
}

// React to a deep-link / list-click request: ensure the entry exists, expand it, fetch + scroll.
// `immediate` so a request that fired BEFORE this panel mounted (the tab was just switched to it)
// is still picked up; the request is cleared once handled so re-opening the tab won't re-trigger it.
watch(requestedPublicNote, async (req) => {
  if (!req) return
  const { noteId } = req
  requestedPublicNote.value = null
  if (!list.value.length) await loadList()
  if (!list.value.some((n) => n.id === noteId)) {
    // Safety net: not in the public list (e.g. just published) — pull it directly if readable.
    const note = await notesApi.getById(noteId)
    if (note) {
      list.value = [{ id: note.id, user_id: note.user_id, username: note.username, updated_at: note.updated_at }, ...list.value]
      bodies[noteId] = note
    } else {
      return
    }
  }
  open[noteId] = true
  await fetchBody(noteId)
  await nextTick()
  entryEls[noteId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}, { immediate: true })

onMounted(loadList)
watch(() => props.paperId, () => {
  list.value = []
  for (const k of Object.keys(open)) delete open[Number(k)]
  for (const k of Object.keys(bodies)) delete bodies[Number(k)]
  loadList()
})
</script>

<template>
  <div v-if="list.length" class="pnp space-y-2">
    <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
      <Users class="h-3 w-3" /> Public notes from others
    </div>
    <Collapsible
      v-for="n in list" :key="n.id"
      :ref="(el: any) => setEntryEl(n.id, el?.$el ?? el)"
      :open="open[n.id] || false"
      class="rounded-md border"
      @update:open="(v: boolean) => onToggle(n.id, v)"
    >
      <CollapsibleTrigger class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 cursor-pointer">
        <ChevronRight class="h-3.5 w-3.5 shrink-0 transition-transform" :class="open[n.id] ? 'rotate-90' : ''" />
        <span class="text-sm font-medium truncate flex-1">{{ n.username }}</span>
        <span class="text-xs text-muted-foreground shrink-0">{{ fmt(n.updated_at) }}</span>
      </CollapsibleTrigger>
      <CollapsibleContent class="px-3 pb-3 pt-1 border-t">
        <div v-if="bodies[n.id] === 'loading'" class="flex justify-center py-4">
          <Loader2 class="h-4 w-4 animate-spin text-primary" />
        </div>
        <div v-else-if="bodies[n.id] === 'error'" class="text-xs text-muted-foreground py-3 text-center">
          Note unavailable.
        </div>
        <PublicNoteView
          v-else-if="bodies[n.id]"
          :body="(bodies[n.id] as NoteWithAuthor).body"
          :paper-id="paperId"
        />
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>

<style scoped>
.pnp { padding: 4px 2px; }
</style>
