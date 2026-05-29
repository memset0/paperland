<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { api } from '@/api/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Star } from '@lucide/vue'

const props = defineProps<{ paperId: number }>()

interface Edge {
  id: number
  direction: string
  arxiv_id: string | null
  doi: string | null
  url: string | null
  title: string | null
  authors: string[]
  year: number | null
  venue: string | null
  contexts: string[]
  intents: string[]
  is_influential: boolean
}

const references = ref<Edge[]>([])
const citations = ref<Edge[]>([])
const open = ref<Record<string, boolean>>({ reference: false, citation: false })
const MAX_SHOW = 60

async function load() {
  try {
    const d = await api.get<{ references: Edge[]; citations: Edge[] }>(`/api/papers/${props.paperId}/citations`)
    references.value = d.references || []
    citations.value = d.citations || []
  } catch {
    references.value = []
    citations.value = []
  }
}
onMounted(load)
watch(() => props.paperId, load)

const sections = computed(() =>
  [
    { key: 'reference', title: '参考文献', sub: '本文引用的论文', items: references.value },
    { key: 'citation', title: '被引用', sub: '引用本文的论文', items: citations.value },
  ].filter((s) => s.items.length > 0)
)
const hasData = computed(() => references.value.length > 0 || citations.value.length > 0)

function linkOf(e: Edge): string | null {
  return e.url || (e.arxiv_id ? `https://arxiv.org/abs/${e.arxiv_id}` : e.doi ? `https://doi.org/${e.doi}` : null)
}
function authorsLabel(a: string[]): string {
  if (!a?.length) return ''
  return a.length <= 3 ? a.join(', ') : `${a.slice(0, 3).join(', ')} 等`
}
</script>

<template>
  <Card v-if="hasData" class="overflow-hidden gap-0 py-0">
    <Collapsible v-for="s in sections" :key="s.key" :open="open[s.key]" @update:open="(v: boolean) => (open[s.key] = v)">
      <CollapsibleTrigger class="flex w-full items-center gap-2 px-5 py-3 cursor-pointer hover:bg-muted/40 transition-colors text-left border-b">
        <span class="text-sm font-semibold">{{ s.title }}</span>
        <Badge variant="secondary">{{ s.items.length }}</Badge>
        <span class="ml-auto text-xs text-muted-foreground">{{ s.sub }}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul class="divide-y max-h-96 overflow-y-auto">
          <li v-for="e in s.items.slice(0, MAX_SHOW)" :key="e.id" class="px-5 py-2.5">
            <div class="flex items-start gap-1.5">
              <a v-if="linkOf(e)" :href="linkOf(e)!" target="_blank" rel="noopener" class="text-sm font-medium text-primary hover:underline">{{ e.title || '(无标题)' }}</a>
              <span v-else class="text-sm font-medium">{{ e.title || '(无标题)' }}</span>
              <Star v-if="e.is_influential" class="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500 fill-amber-500" />
            </div>
            <div class="text-xs text-muted-foreground mt-0.5">
              <span v-if="e.authors.length">{{ authorsLabel(e.authors) }}</span>
              <span v-if="e.year"> · {{ e.year }}</span>
              <span v-if="e.venue"> · {{ e.venue }}</span>
            </div>
            <p v-if="e.contexts.length" class="text-xs text-muted-foreground/80 mt-1 italic line-clamp-2">“{{ e.contexts[0] }}”</p>
          </li>
        </ul>
        <p v-if="s.items.length > MAX_SHOW" class="px-5 py-2 text-xs text-muted-foreground border-t">共 {{ s.items.length }} 条，显示前 {{ MAX_SHOW }} 条</p>
      </CollapsibleContent>
    </Collapsible>
  </Card>
</template>
