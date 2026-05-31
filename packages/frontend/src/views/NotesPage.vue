<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { notesApi } from '@/api/client'
import type { NoteWithPaper } from '@paperland/shared'
import { usePageTitle } from '@/composables/usePageTitle'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2, FileText } from '@lucide/vue'
import AppPage from '@/components/AppPage.vue'

// One note per paper (the single document). Searchable over the paper title + note body;
// selecting a note opens that paper (its document view lives on the paper detail page).
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
  const list = [...all.value].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  if (!q) return list
  return list.filter(
    (n) => n.paper_title.toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q),
  )
})

function snippet(body: string): string {
  return body.replace(/[#*`>[\]()_~-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
}
</script>

<template>
  <AppPage>
    <div class="space-y-4">
      <Input v-model="query" placeholder="Search notes…" />

      <div v-if="loading" class="flex justify-center py-16">
        <Loader2 class="h-5 w-5 animate-spin text-primary" />
      </div>
      <div v-else-if="!filtered.length" class="text-sm text-muted-foreground text-center py-16">
        {{ all.length ? 'No matching notes.' : 'No notes yet.' }}
      </div>
      <Card v-else class="divide-y overflow-hidden py-0">
        <button
          v-for="n in filtered" :key="n.paper_id"
          class="block w-full text-left px-4 py-3 hover:bg-muted/40"
          @click="router.push(`/papers/${n.paper_id}`)"
        >
          <div class="text-sm font-medium inline-flex items-center gap-1.5">
            <FileText class="h-3.5 w-3.5 shrink-0" /> {{ n.paper_title }}
          </div>
          <div v-if="snippet(n.body)" class="text-xs text-muted-foreground line-clamp-2 mt-0.5">{{ snippet(n.body) }}</div>
        </button>
      </Card>
    </div>
  </AppPage>
</template>
