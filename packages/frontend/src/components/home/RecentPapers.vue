<script setup lang="ts">
// Home → Recent papers: the signed-in user's latest library additions (Mine scope), newest first,
// as cards that open the paper. Uses the regular list endpoint with `sort_by=added_at`.
import { onMounted, ref } from 'vue'
import { FileText } from '@lucide/vue'
import type { PaginatedResponse, Paper } from '@paperland/shared'
import { api } from '@/api/client'
import { useTagsStore } from '@/stores/tags'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import TagBadge from '@/components/TagBadge.vue'

const LIMIT = 6

// The list endpoint attaches the caller's tags to each item.
type ListPaper = Paper & { tags?: { id: number; name: string }[] }

const tagsStore = useTagsStore()
const papers = ref<ListPaper[]>([])
const loaded = ref(false)

function formatDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''
}

function visibleTags(p: ListPaper) {
  return (p.tags ?? []).filter((t) => tagsStore.tags.find((st) => st.id === t.id)?.visible !== false)
}

onMounted(async () => {
  try {
    const params = new URLSearchParams({ page: '1', page_size: String(LIMIT), scope: 'mine', sort_by: 'added_at', sort_order: 'desc' })
    papers.value = (await api.get<PaginatedResponse<ListPaper>>(`/api/papers?${params}`)).data
  } catch {
    papers.value = []
  } finally {
    loaded.value = true
  }
})
</script>

<template>
  <Card class="gap-0 overflow-hidden py-0">
    <div class="flex items-center gap-2 border-b px-5 py-3">
      <FileText class="h-4 w-4 text-muted-foreground" />
      <h3 class="text-sm font-semibold">Recent papers</h3>
      <Button as-child size="xs" variant="ghost" class="ml-auto">
        <RouterLink to="/papers">All papers</RouterLink>
      </Button>
    </div>
    <div v-if="papers.length" class="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink
        v-for="p in papers"
        :key="p.id"
        :to="`/papers/${p.id}`"
        class="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-card p-3 transition-shadow hover:shadow-md"
      >
        <span class="line-clamp-2 text-sm font-semibold leading-snug">{{ p.title }}</span>
        <span class="truncate text-xs text-muted-foreground">{{ p.authors.join(', ') }}</span>
        <div v-if="visibleTags(p).length" class="flex flex-wrap gap-1">
          <TagBadge v-for="t in visibleTags(p)" :key="t.id" :tag-id="t.id" :tag-name="t.name" />
        </div>
        <span class="mt-auto pt-1 text-[11px] text-muted-foreground">
          Added {{ formatDate(p.added_at) }}<template v-if="p.arxiv_id"> · arXiv {{ p.arxiv_id }}</template>
        </span>
      </RouterLink>
    </div>
    <div v-else-if="loaded" class="py-10 text-center text-sm text-muted-foreground">
      No papers in your library yet ·
      <RouterLink to="/papers" class="underline underline-offset-2 hover:text-foreground">Go to Papers</RouterLink>
    </div>
  </Card>
</template>
