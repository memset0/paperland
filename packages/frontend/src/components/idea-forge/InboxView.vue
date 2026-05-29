<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import IdeaDetail from './IdeaDetail.vue'
import ScoreInput from './ScoreInput.vue'
import type { Idea, IdeaCategory } from '@paperland/shared'
import { IDEA_CATEGORY_VARIANT } from '@/lib/idea-categories'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  projectName: string
  ideas: Idea[]
}>()

const emit = defineEmits<{
  refresh: []
  selectIdea: [category: string, dirName: string]
}>()

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

watch(() => props.ideas, (list) => {
  if (list.length > 0 && !selectedIdea.value) {
    selectIdea(list[0])
  }
}, { immediate: true })

defineExpose({ selectByKey })
</script>

<template>
  <div class="flex h-full">
    <div class="w-[340px] shrink-0 border-r overflow-y-auto bg-background">
      <div v-if="ideas.length === 0" class="p-6 text-center text-sm text-muted-foreground">
        No ideas found
      </div>
      <Button
        v-for="idea in ideas" :key="`${idea.category}/${idea.dir_name}`"
        variant="ghost"
        :class="[
          'w-full justify-start h-auto py-3 px-4 border-b rounded-none flex-col items-stretch gap-1.5 text-left whitespace-normal',
          idea.category === selectedCategory && idea.dir_name === selectedName ? 'bg-accent border-l-2 border-l-primary' : ''
        ]"
        @click="selectIdea(idea)"
      >
        <div class="flex items-start justify-between gap-2">
          <span class="text-sm font-medium line-clamp-1">{{ idea.name || idea.dir_name }}</span>
          <ScoreInput :model-value="idea.my_score" readonly size="sm" />
        </div>
        <p class="text-xs text-muted-foreground line-clamp-2">{{ idea.summary }}</p>
        <div class="flex items-center gap-2">
          <Badge :variant="IDEA_CATEGORY_VARIANT[idea.category as IdeaCategory] || 'outline'">{{ idea.category }}</Badge>
          <span class="text-[10px] text-muted-foreground">{{ idea.update_time?.slice(0, 10) }}</span>
          <span v-if="idea.author" class="text-[10px] text-muted-foreground">· {{ idea.author }}</span>
        </div>
      </Button>
    </div>

    <div class="flex-1 min-w-0">
      <IdeaDetail
        v-if="selectedCategory && selectedName"
        :project-name="projectName"
        :category="selectedCategory"
        :idea-name="selectedName"
        @moved="onMoved"
        @saved="onSaved"
      />
      <div v-else class="flex items-center justify-center h-full text-sm text-muted-foreground">
        Select an idea from the list
      </div>
    </div>
  </div>
</template>
