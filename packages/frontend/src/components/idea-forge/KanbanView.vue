<script setup lang="ts">
import { computed } from 'vue'
import draggable from 'vuedraggable'
import { useIdeasStore } from '@/stores/ideas'
import ScoreInput from './ScoreInput.vue'
import type { Idea, IdeaCategory } from '@paperland/shared'

const props = defineProps<{
  projectName: string
  ideas: Idea[]
}>()

const emit = defineEmits<{
  clickIdea: [category: string, dirName: string]
  refresh: []
}>()

const store = useIdeasStore()

const categories: IdeaCategory[] = ['unreviewed', 'under-review', 'validating', 'archived']
const categoryLabels: Record<string, string> = {
  'unreviewed': 'Unreviewed',
  'under-review': 'Under Review',
  'validating': 'Validating',
  'archived': 'Archived',
}
const categoryColors: Record<string, string> = {
  'unreviewed': 'bg-gray-50 border-gray-200',
  'under-review': 'bg-blue-50 border-blue-200',
  'validating': 'bg-amber-50 border-amber-200',
  'archived': 'bg-green-50 border-green-200',
}
const headerColors: Record<string, string> = {
  'unreviewed': 'text-gray-700',
  'under-review': 'text-blue-700',
  'validating': 'text-amber-700',
  'archived': 'text-green-700',
}

const columns = computed(() => {
  const map: Record<string, Idea[]> = {}
  for (const cat of categories) map[cat] = []
  for (const idea of props.ideas) {
    if (map[idea.category]) map[idea.category].push(idea)
  }
  return map
})

async function onDragEnd(cat: IdeaCategory, evt: any) {
  // draggable fires when item is added to a column
  if (evt.added) {
    const idea: Idea = evt.added.element
    if (idea.category === cat) return

    // We need the content_hash to move — fetch detail first
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
      v-for="cat in categories" :key="cat"
      :class="['shrink-0 rounded-xl border p-3 flex flex-col', categoryColors[cat]]"
      style="min-width: 280px; width: 280px;"
    >
      <div class="flex items-center justify-between mb-3 px-1">
        <h3 :class="['text-sm font-semibold', headerColors[cat]]">{{ categoryLabels[cat] }}</h3>
        <span class="rounded-full bg-white/80 px-2 py-0.5 text-xs text-gray-500">{{ columns[cat].length }}</span>
      </div>

      <draggable
        :list="columns[cat]"
        group="ideas"
        item-key="dir_name"
        class="flex-1 space-y-2 min-h-[100px]"
        @change="(e: any) => onDragEnd(cat, e)"
      >
        <template #item="{ element: idea }">
          <div
            class="rounded-lg bg-white border border-gray-200 p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition"
          >
            <button
              @click="emit('clickIdea', idea.category, idea.dir_name)"
              class="text-left w-full"
            >
              <div class="text-sm font-medium text-gray-900 line-clamp-1 mb-1">{{ idea.name || idea.dir_name }}</div>
              <p class="text-xs text-gray-500 line-clamp-2 mb-2">{{ idea.summary }}</p>
              <div class="flex items-center justify-between">
                <ScoreInput :model-value="idea.my_score" readonly size="sm" />
                <span class="text-[10px] text-gray-400">{{ idea.update_time?.slice(0, 10) }}</span>
              </div>
            </button>
          </div>
        </template>
      </draggable>
    </div>
  </div>
</template>
