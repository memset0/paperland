<script setup lang="ts">
import ScoreInput from './ScoreInput.vue'
import type { Idea } from '@paperland/shared'
import { ArrowUpDown } from '@lucide/vue'
import type { IdeaCategory } from '@paperland/shared'
import { IDEA_CATEGORY_VARIANT } from '@/lib/idea-categories'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

defineProps<{ ideas: Idea[] }>()

const emit = defineEmits<{
  clickIdea: [category: string, dirName: string]
  sort: [field: string]
}>()
</script>

<template>
  <div class="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead class="max-w-xs">Summary</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>LLM</TableHead>
          <TableHead>Author</TableHead>
          <TableHead class="cursor-pointer" @click="emit('sort', 'create_time')">
            <span class="flex items-center gap-1">Created <ArrowUpDown class="h-3 w-3" /></span>
          </TableHead>
          <TableHead class="cursor-pointer" @click="emit('sort', 'update_time')">
            <span class="flex items-center gap-1">Updated <ArrowUpDown class="h-3 w-3" /></span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="idea in ideas" :key="`${idea.category}/${idea.dir_name}`"
          class="cursor-pointer"
          @click="emit('clickIdea', idea.category, idea.dir_name)"
        >
          <TableCell>
            <div class="font-medium">{{ idea.name || idea.dir_name }}</div>
            <div v-if="idea.tags?.length" class="flex gap-1 flex-wrap mt-1">
              <Badge v-for="tag in idea.tags" :key="tag" variant="secondary">{{ tag }}</Badge>
            </div>
          </TableCell>
          <TableCell>
            <Badge :variant="IDEA_CATEGORY_VARIANT[idea.category as IdeaCategory] || 'outline'">{{ idea.category }}</Badge>
          </TableCell>
          <TableCell class="text-muted-foreground max-w-xs"><span class="line-clamp-5">{{ idea.summary }}</span></TableCell>
          <TableCell><ScoreInput :model-value="idea.my_score" readonly size="sm" /></TableCell>
          <TableCell><ScoreInput :model-value="idea.llm_score" readonly size="sm" /></TableCell>
          <TableCell class="text-xs text-muted-foreground whitespace-nowrap">{{ idea.author }}</TableCell>
          <TableCell class="text-xs text-muted-foreground whitespace-nowrap">{{ idea.create_time?.slice(0, 10) }}</TableCell>
          <TableCell class="text-xs text-muted-foreground whitespace-nowrap">{{ idea.update_time?.slice(0, 10) }}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
    <div v-if="ideas.length === 0" class="text-center py-12 text-sm text-muted-foreground">No ideas found</div>
  </div>
</template>
