<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useNotesStore } from '@/stores/notes'
import { useWindowsStore } from '@/stores/windows'
import { useAuthStore } from '@/stores/auth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import MarkdownContent from './MarkdownContent.vue'
import NoteMindmap from './notes/NoteMindmap.vue'
import { NotebookPen, Pencil } from '@lucide/vue'

// Notes card: a walkthrough entry + the branching mind-map of small notes.
// Editing happens in floating windows (opened from the pencil / mind-map nodes).
const props = defineProps<{ paperId: number }>()
const store = useNotesStore()
const windows = useWindowsStore()
const auth = useAuthStore()
const route = useRoute()

async function load(id: number) {
  if (!auth.isAuthenticated) return
  await store.fetchForPaper(id)
  // Opened from the /notes page, which navigates here with ?note= / ?walkthrough=.
  if (route.query.walkthrough) {
    windows.open({ kind: 'walkthrough', paperId: id, title: 'Walkthrough' })
  } else if (route.query.note) {
    const noteId = parseInt(route.query.note as string, 10)
    const n = store.notes.find((x) => x.id === noteId)
    if (n) windows.open({ kind: 'note', paperId: id, noteId, title: n.title || '(untitled)' })
  }
}
onMounted(() => load(props.paperId))
watch(() => props.paperId, (id) => load(id))

function openWalkthrough() {
  windows.open({ kind: 'walkthrough', paperId: props.paperId, title: 'Walkthrough' })
}
</script>

<template>
  <Card class="overflow-hidden gap-0 py-0">
    <div class="flex items-center justify-between border-b px-5 py-3">
      <h3 class="text-sm font-semibold flex items-center gap-2">
        <NotebookPen class="h-4 w-4" /> Notes
      </h3>
    </div>

    <div v-if="!auth.isAuthenticated" class="px-5 py-8 text-center text-sm text-muted-foreground">
      Sign in to take notes
    </div>

    <div v-else class="px-5 py-4 space-y-4">
      <div class="space-y-1">
        <div class="flex items-center justify-between">
          <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Walkthrough</div>
          <Button size="icon-xs" variant="ghost" title="Edit walkthrough" @click="openWalkthrough">
            <Pencil />
          </Button>
        </div>
        <MarkdownContent v-if="store.walkthrough?.body" :content="store.walkthrough.body" :paper-id="paperId" class="text-sm" />
        <p v-else class="text-sm text-muted-foreground">No walkthrough yet — click the pencil to start.</p>
      </div>

      <NoteMindmap :paper-id="paperId" />
    </div>
  </Card>
</template>
