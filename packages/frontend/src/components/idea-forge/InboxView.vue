<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useIdeasStore } from '@/stores/ideas'
import IdeaDetail from './IdeaDetail.vue'
import ScoreInput from './ScoreInput.vue'
import type { Idea, IdeaCategory } from '@paperland/shared'

const props = defineProps<{
  projectName: string
  ideas: Idea[]
}>()

const emit = defineEmits<{
  refresh: []
  selectIdea: [category: string, dirName: string]
}>()

const store = useIdeasStore()
const selectedCategory = ref<string>('')
const selectedName = ref<string>('')

const selectedIdea = computed(() =>
  props.ideas.find(i => i.category === selectedCategory.value && i.dir_name === selectedName.value)
)

function selectIdea(idea: Idea) {
  selectedCategory.value = idea.category
  selectedName.value = idea.dir_name
}

function selectByKey(category: string, dirName: string) {
  selectedCategory.value = category
  selectedName.value = dirName
}

function onMoved(newCat: IdeaCategory) {
  selectedCategory.value = newCat
  emit('refresh')
}

function onSaved() {
  emit('refresh')
}

// Auto-select first if nothing selected
watch(() => props.ideas, (list) => {
  if (list.length > 0 && !selectedIdea.value) {
    selectIdea(list[0])
  }
}, { immediate: true })

const categoryColors: Record<string, string> = {
  'unreviewed': 'bg-gray-100 text-gray-600',
  'under-review': 'bg-blue-100 text-blue-700',
  'validating': 'bg-amber-100 text-amber-700',
  'archived': 'bg-green-100 text-green-700',
}

defineExpose({ selectByKey })
</script>

<template>
  <div class="flex h-full">
    <!-- Left: idea list -->
    <div class="w-[340px] shrink-0 border-r border-gray-200 overflow-y-auto bg-white">
      <div v-if="ideas.length === 0" class="p-6 text-center text-sm text-gray-400">
        No ideas found
      </div>
      <button
        v-for="idea in ideas" :key="`${idea.category}/${idea.dir_name}`"
        @click="selectIdea(idea)"
        :class="[
          'w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition',
          idea.category === selectedCategory && idea.dir_name === selectedName ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''
        ]"
      >
        <div class="flex items-start justify-between gap-2 mb-1">
          <span class="text-sm font-medium text-gray-900 line-clamp-1">{{ idea.name || idea.dir_name }}</span>
          <ScoreInput :model-value="idea.my_score" readonly size="sm" />
        </div>
        <p class="text-xs text-gray-500 line-clamp-2 mb-1.5">{{ idea.summary }}</p>
        <div class="flex items-center gap-2">
          <span :class="['rounded-full px-2 py-0.5 text-[10px] font-medium', categoryColors[idea.category] || 'bg-gray-100 text-gray-600']">
            {{ idea.category }}
          </span>
          <span class="text-[10px] text-gray-400">{{ idea.update_time?.slice(0, 10) }}</span>
          <span v-if="idea.author" class="text-[10px] text-gray-400">· {{ idea.author }}</span>
        </div>
      </button>
    </div>

    <!-- Right: detail -->
    <div class="flex-1 min-w-0">
      <IdeaDetail
        v-if="selectedCategory && selectedName"
        :project-name="projectName"
        :category="selectedCategory"
        :idea-name="selectedName"
        @moved="onMoved"
        @saved="onSaved"
      />
      <div v-else class="flex items-center justify-center h-full text-sm text-gray-400">
        Select an idea from the list
      </div>
    </div>
  </div>
</template>
