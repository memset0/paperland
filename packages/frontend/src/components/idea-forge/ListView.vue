<script setup lang="ts">
import ScoreInput from './ScoreInput.vue'
import type { Idea } from '@paperland/shared'
import { ArrowUpDown } from 'lucide-vue-next'

defineProps<{
  ideas: Idea[]
}>()

const emit = defineEmits<{
  clickIdea: [category: string, dirName: string]
  sort: [field: string]
}>()

const categoryColors: Record<string, string> = {
  'unreviewed': 'bg-gray-100 text-gray-600',
  'under-review': 'bg-blue-100 text-blue-700',
  'validating': 'bg-amber-100 text-amber-700',
  'archived': 'bg-green-100 text-green-700',
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="border-b border-gray-200 bg-gray-50/50">
        <tr>
          <th class="text-left px-4 py-2.5 font-medium text-gray-600">Name</th>
          <th class="text-left px-4 py-2.5 font-medium text-gray-600">Category</th>
          <th class="text-left px-4 py-2.5 font-medium text-gray-600 max-w-xs">Summary</th>
          <th class="text-left px-4 py-2.5 font-medium text-gray-600">Score</th>
          <th class="text-left px-4 py-2.5 font-medium text-gray-600">LLM</th>
          <th class="text-left px-4 py-2.5 font-medium text-gray-600">Author</th>
          <th class="px-4 py-2.5 font-medium text-gray-600 cursor-pointer hover:text-gray-900" @click="emit('sort', 'create_time')">
            <span class="flex items-center gap-1">Created <ArrowUpDown class="h-3 w-3" /></span>
          </th>
          <th class="px-4 py-2.5 font-medium text-gray-600 cursor-pointer hover:text-gray-900" @click="emit('sort', 'update_time')">
            <span class="flex items-center gap-1">Updated <ArrowUpDown class="h-3 w-3" /></span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="idea in ideas" :key="`${idea.category}/${idea.dir_name}`"
          @click="emit('clickIdea', idea.category, idea.dir_name)"
          class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition"
        >
          <td class="px-4 py-2.5">
            <div class="font-medium text-gray-900">{{ idea.name || idea.dir_name }}</div>
            <div v-if="idea.tags?.length" class="flex gap-1 flex-wrap mt-1">
              <span v-for="tag in idea.tags" :key="tag" class="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{{ tag }}</span>
            </div>
          </td>
          <td class="px-4 py-2.5">
            <span :class="['rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap', categoryColors[idea.category] || 'bg-gray-100 text-gray-600']">
              {{ idea.category }}
            </span>
          </td>
          <td class="px-4 py-2.5 text-gray-500 max-w-xs"><span class="line-clamp-5">{{ idea.summary }}</span></td>
          <td class="px-4 py-2.5"><ScoreInput :model-value="idea.my_score" readonly size="sm" /></td>
          <td class="px-4 py-2.5"><ScoreInput :model-value="idea.llm_score" readonly size="sm" /></td>
          <td class="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">{{ idea.author }}</td>
          <td class="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">{{ idea.create_time?.slice(0, 10) }}</td>
          <td class="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">{{ idea.update_time?.slice(0, 10) }}</td>
        </tr>
      </tbody>
    </table>
    <div v-if="ideas.length === 0" class="text-center py-12 text-sm text-gray-400">No ideas found</div>
  </div>
</template>
