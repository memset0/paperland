<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useNotesStore } from '@/stores/notes'
import { useWindowsStore } from '@/stores/windows'
import { useAuthStore } from '@/stores/auth'
import { Card } from '@/components/ui/card'
import NoteMindmap from './notes/NoteMindmap.vue'
import { NotebookPen } from '@lucide/vue'

// Notes card: the single note tree rendered as a branching mind-map, rooted at the
// (lazily-created) root note. Editing happens in floating windows (opened from nodes).
const props = defineProps<{ paperId: number }>()
const store = useNotesStore()
const windows = useWindowsStore()
const auth = useAuthStore()
const route = useRoute()

async function load(id: number) {
  if (!auth.isAuthenticated) return
  await store.fetchForPaper(id)
  // Opened from the /notes page, which navigates here with ?note= / ?root=.
  if (route.query.root) {
    windows.open({ kind: 'root', paperId: id, title: '(root)' })
  } else if (route.query.note) {
    const noteId = parseInt(route.query.note as string, 10)
    const n = store.notes.find((x) => x.id === noteId)
    if (n) windows.open({ kind: 'note', paperId: id, noteId, title: n.title || '(untitled)' })
  }
}
onMounted(() => load(props.paperId))
watch(() => props.paperId, (id) => load(id))
</script>

<template>
  <Card class="overflow-hidden gap-0 py-0">
    <div class="flex items-center justify-between border-b px-5 py-3">
      <h3 class="text-sm font-semibold flex items-center gap-2">
        <NotebookPen class="h-4 w-4" /> Notes
        <span v-if="auth.isAuthenticated" class="font-normal text-muted-foreground">({{ store.noteCount }})</span>
      </h3>
    </div>

    <div v-if="!auth.isAuthenticated" class="px-5 py-8 text-center text-sm text-muted-foreground">
      Sign in to take notes
    </div>

    <div v-else class="px-5 py-4">
      <NoteMindmap :paper-id="paperId" />
    </div>
  </Card>
</template>
