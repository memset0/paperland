<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useNotesStore } from '@/stores/notes'
import { useAuthStore } from '@/stores/auth'
import { Card } from '@/components/ui/card'
import NoteMindmap from './notes/NoteMindmap.vue'
import { NotebookPen } from '@lucide/vue'

// Notes card: the single note document rendered as a heading-derived mind-map. The center node
// is the paper (its preamble); editing happens in floating windows opened from nodes. The full
// document view (with edit/split/render modes) lives in the left panel (NoteWalkthrough).
const props = defineProps<{ paperId: number }>()
const store = useNotesStore()
const auth = useAuthStore()

async function load(id: number) {
  if (!auth.isAuthenticated) return
  await store.fetchForPaper(id)
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
