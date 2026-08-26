<script setup lang="ts">
import { ref, watch } from 'vue'
import type { QAResult } from '@paperland/shared'
import { requestedResultId } from '@/composables/useBlockAnchor'
import QAResultBody from './QAResultBody.vue'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  chooseActiveQAResult,
  compareQAResultsNewestFirst,
  qaResultSignature,
} from '@/lib/qa-result-selection'

const props = withDefaults(defineProps<{
  results: QAResult[]
  entryKey: string
  paperId: number
  highlightPathname?: string
  canManage?: boolean
}>(), { canManage: true })

const emit = defineEmits<{
  regenerate: [modelName: string]
  deleteResult: [resultId: number]
  cancelResult: [resultId: number]
}>()

function pinKey() { return `qa-pin-${props.paperId}-${props.entryKey}` }
function getPinnedModel(): string | null { return localStorage.getItem(pinKey()) }

function sortedResults(): QAResult[] {
  const pinned = getPinnedModel()
  return [...props.results].sort((a, b) => {
    if (pinned) {
      if (a.model_name === pinned && b.model_name !== pinned) return -1
      if (b.model_name === pinned && a.model_name !== pinned) return 1
    }
    return compareQAResultsNewestFirst(a, b)
  })
}

function compactStatus(status: QAResult['status']): string {
  if (status === 'queued') return 'Queued'
  if (status === 'awaiting_output') return 'Thinking'
  if (status === 'streaming') return 'Streaming'
  if (status === 'failed') return 'Failed'
  if (status === 'cancelled') return 'Stopped'
  return 'Done'
}

const activeTab = ref('')
const previousResultIds = ref<Set<number>>(new Set())

watch(
  () => qaResultSignature(props.results),
  () => {
    const requested = requestedResultId.value
    activeTab.value = chooseActiveQAResult({
      results: props.results,
      previousIds: previousResultIds.value,
      activeId: activeTab.value,
      requestedId: requested,
    })
    previousResultIds.value = new Set(props.results.map((result) => result.id))
    if (requested != null && activeTab.value === String(requested)) requestedResultId.value = null
  },
  { immediate: true },
)

watch(requestedResultId, (id) => {
  if (id != null && props.results.some((result) => result.id === id)) {
    activeTab.value = String(id)
    requestedResultId.value = null
  }
}, { immediate: true })
</script>

<template>
  <Tabs v-if="results.length > 1" v-model="activeTab">
    <TabsList class="w-full justify-start overflow-x-auto">
      <TabsTrigger v-for="result in sortedResults()" :key="result.id" :value="String(result.id)">
        <span class="flex items-center gap-1.5">
          <span class="max-w-40 truncate">{{ result.model_name }}</span>
          <Badge variant="secondary" class="h-4 px-1 text-[9px]">{{ compactStatus(result.status) }}</Badge>
        </span>
      </TabsTrigger>
    </TabsList>
    <TabsContent v-for="result in sortedResults()" :key="result.id" :value="String(result.id)">
      <QAResultBody
        :result="result"
        :entry-key="entryKey"
        :paper-id="paperId"
        :highlight-pathname="highlightPathname"
        :can-manage="canManage"
        @regenerate="emit('regenerate', $event)"
        @delete-result="emit('deleteResult', $event)"
        @cancel-result="emit('cancelResult', $event)"
      />
    </TabsContent>
  </Tabs>

  <QAResultBody
    v-else-if="results.length === 1"
    :result="results[0]"
    :entry-key="entryKey"
    :paper-id="paperId"
    :highlight-pathname="highlightPathname"
    :can-manage="canManage"
    :show-model="true"
    @regenerate="emit('regenerate', $event)"
    @delete-result="emit('deleteResult', $event)"
    @cancel-result="emit('cancelResult', $event)"
  />
</template>
