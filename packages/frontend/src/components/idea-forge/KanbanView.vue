<script setup lang="ts">
import { computed } from 'vue'
import draggable from 'vuedraggable'
import { useIdeasStore } from '@/stores/ideas'
import ScoreInput from './ScoreInput.vue'
import type { Idea, IdeaCategory } from '@paperland/shared'
import { IDEA_CATEGORIES, IDEA_CATEGORY_LABELS } from '@/lib/idea-categories'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{
  projectName: string
  ideas: Idea[]
}>()

const emit = defineEmits<{
  clickIdea: [category: string, dirName: string]
  refresh: []
}>()

const store = useIdeasStore()

const columns = computed(() => {
  const map: Record<string, Idea[]> = {}
  for (const cat of IDEA_CATEGORIES) map[cat] = []
  for (const idea of props.ideas) {
    if (map[idea.category]) map[idea.category].push(idea)
  }
  return map
})

async function onDragEnd(cat: IdeaCategory, evt: any) {
  if (evt.added) {
    const idea: Idea = evt.added.element
    if (idea.category === cat) return

    const detail = await store.fetchDetail(props.projectName, idea.category, idea.dir_name)
    if (detail) {
      await store.moveIdea(props.projectName, idea.category, idea.dir_name, cat, detail.content_hash)
      emit('refresh')
    }
  }
}
</script>

<template>
  <div class="flex gap-4 h-full overflow-x-auto p-4">
    <div
      v-for="cat in IDEA_CATEGORIES" :key="cat"
      class="shrink-0 rounded-lg border bg-muted/40 p-3 flex flex-col"
      style="min-width: 280px; width: 280px;"
    >
      <div class="flex items-center justify-between mb-3 px-1">
        <h3 class="text-sm font-semibold">{{ IDEA_CATEGORY_LABELS[cat] }}</h3>
        <Badge variant="secondary">{{ columns[cat].length }}</Badge>
      </div>

      <draggable
        :list="columns[cat]"
        group="ideas"
        item-key="dir_name"
        class="flex-1 space-y-2 min-h-[100px]"
        @change="(e: any) => onDragEnd(cat, e)"
      >
        <template #item="{ element: idea }">
          <Card class="p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition gap-2">
            <button
              type="button"
              class="text-left w-full space-y-2"
              @click="emit('clickIdea', idea.category, idea.dir_name)"
            >
              <div class="text-sm font-medium line-clamp-1">{{ idea.name || idea.dir_name }}</div>
              <p class="text-xs text-muted-foreground line-clamp-2">{{ idea.summary }}</p>
              <div class="flex items-center justify-between">
                <ScoreInput :model-value="idea.my_score" readonly size="sm" />
                <span class="text-[10px] text-muted-foreground">{{ idea.update_time?.slice(0, 10) }}</span>
              </div>
            </button>
          </Card>
        </template>
      </draggable>
    </div>
  </div>
</template>
