<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { notesApi } from '@/api/client'
import type { NoteWithPaper } from '@paperland/shared'
import { usePageTitle } from '@/composables/usePageTitle'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2, NotebookPen, FileText } from '@lucide/vue'

const router = useRouter()
const all = ref<NoteWithPaper[]>([])
const loading = ref(true)
const query = ref('')

usePageTitle(() => 'Notes')

onMounted(async () => {
  try {
    const res = await notesApi.listAll()
    all.value = res.data
  } finally {
    loading.value = false
  }
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return all.value
  return all.value.filter(
    (n) => (n.title || '').toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q),
  )
})

interface Group { paperId: number; paperTitle: string; notes: NoteWithPaper[] }
const groups = computed<Group[]>(() => {
  const map = new Map<number, Group>()
  for (const n of filtered.value) {
    let g = map.get(n.paper_id)
    if (!g) { g = { paperId: n.paper_id, paperTitle: n.paper_title, notes: [] }; map.set(n.paper_id, g) }
    g.notes.push(n)
  }
  for (const g of map.values()) {
    g.notes.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }
  return [...map.values()]
})

function snippet(body: string): string {
  return body.replace(/[#*`>[\]()_~-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
}

/** Open a note in the context of its paper (the editor window binds to that paper's store). */
function openNote(n: NoteWithPaper) {
  const q = n.kind === 'root' ? { root: '1' } : { note: String(n.id) }
  router.push({ path: `/papers/${n.paper_id}`, query: q })
}
</script>

<template>
  <div class="max-w-3xl mx-auto p-5 space-y-4">
    <div class="flex items-center gap-2">
      <NotebookPen class="h-5 w-5 text-primary" />
      <h1 class="text-lg font-semibold">Notes</h1>
    </div>

    <Input v-model="query" placeholder="Search notes…" />

    <div v-if="loading" class="flex justify-center py-16">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
    </div>
    <div v-else-if="!groups.length" class="text-sm text-muted-foreground text-center py-16">
      {{ all.length ? 'No matching notes.' : 'No notes yet.' }}
    </div>
    <div v-else class="space-y-5">
      <div v-for="g in groups" :key="g.paperId" class="space-y-2">
        <button
          class="text-sm font-semibold hover:text-primary inline-flex items-center gap-1.5"
          @click="router.push(`/papers/${g.paperId}`)"
        >
          <FileText class="h-3.5 w-3.5" /> {{ g.paperTitle }}
        </button>
        <Card class="divide-y overflow-hidden py-0">
          <button
            v-for="n in g.notes" :key="n.id"
            class="block w-full text-left px-4 py-2.5 hover:bg-muted/40"
            @click="openNote(n)"
          >
            <div class="text-sm font-medium">
              {{ n.kind === 'root' ? '(root)' : (n.title || '(untitled)') }}
            </div>
            <div v-if="snippet(n.body)" class="text-xs text-muted-foreground line-clamp-1">{{ snippet(n.body) }}</div>
          </button>
        </Card>
      </div>
    </div>
  </div>
</template>
