<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQAStore } from '@/stores/qa'
import { useHighlightStore } from '@/stores/highlights'
import { api } from '@/api/client'
import type { QAFeedEntry } from '@paperland/shared'
import {
  CheckCircle2, Loader2, AlertCircle, ChevronRight,
  RefreshCw, ExternalLink
} from '@lucide/vue'
import QAResultView from './QAResultView.vue'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

const props = defineProps<{ entry: QAFeedEntry }>()
const emit = defineEmits<{ refresh: [] }>()

const store = useQAStore()
const highlightStore = useHighlightStore()
const isOpen = ref(false)
const availableModels = ref<Array<{ name: string }>>([])

onMounted(async () => {
  try {
    const res = await api.get<{ models: { available: Array<{ name: string }> } }>('/api/config/models')
    availableModels.value = res.models.available
  } catch {
    availableModels.value = [{ name: 'gpt-4o' }]
  }
})

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    highlightStore.loadForPathname(`/papers/${props.entry.paper_id}`)
  }
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

const regenDialog = ref<{ show: boolean; selectedModels: string[] }>({ show: false, selectedModels: [] })

function openRegenDialog(preselect?: string) {
  regenDialog.value = {
    show: true,
    selectedModels: preselect ? [preselect] : (availableModels.value.length ? [availableModels.value[0].name] : []),
  }
}

function toggleRegenModel(name: string) {
  const models = regenDialog.value.selectedModels
  if (models.includes(name)) {
    regenDialog.value.selectedModels = models.filter(m => m !== name)
  } else {
    models.push(name)
  }
}

async function submitRegen() {
  const { selectedModels } = regenDialog.value
  if (!selectedModels.length) return
  regenDialog.value.show = false
  await store.regenerateEntry(props.entry.entry_id, props.entry.paper_id, selectedModels)
  emit('refresh')
}

async function onDeleteResult(resultId: number) {
  await store.deleteResult(resultId, props.entry.paper_id)
  emit('refresh')
}
</script>

<template>
  <Card class="overflow-hidden gap-0 py-0 transition-shadow hover:shadow-sm">
    <Button
      variant="ghost"
      class="w-full justify-start h-auto py-3.5 px-5 gap-3 rounded-none text-left whitespace-normal"
      @click="toggle"
    >
      <CheckCircle2 v-if="entry.status === 'done'" class="h-4 w-4 text-muted-foreground shrink-0" />
      <Loader2 v-else-if="entry.status === 'running' || entry.status === 'pending'" class="h-4 w-4 text-primary shrink-0 animate-spin" />
      <AlertCircle v-else-if="entry.status === 'failed'" class="h-4 w-4 text-destructive shrink-0" />

      <ChevronRight :class="['h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200', isOpen && 'rotate-90']" />

      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium line-clamp-1">{{ entry.prompt || '自由提问' }}</p>
        <div class="flex items-center gap-2 mt-0.5">
          <router-link
            :to="`/papers/${entry.paper_id}`"
            class="text-[11px] text-primary hover:underline truncate max-w-[200px]"
            @click.stop
          >
            <ExternalLink class="h-3 w-3 inline mr-0.5 -mt-0.5" />{{ entry.paper_title }}
          </router-link>
          <span class="text-[10px] text-muted-foreground">{{ formatDate(entry.created_at) }}</span>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <Badge v-if="entry.results.length > 1" variant="secondary">{{ entry.results.length }} 个回答</Badge>
        <Badge v-else-if="entry.results.length === 1" variant="secondary">{{ entry.results[0].model_name }}</Badge>
        <span v-if="entry.status === 'running' || entry.status === 'pending'" class="text-[10px] text-primary">生成中...</span>
      </div>
    </Button>

    <div v-if="isOpen" class="border-t px-5 py-4">
      <div v-if="entry.results.length > 0">
        <QAResultView
          :results="entry.results"
          :entry-key="`feed-${entry.entry_id}`"
          :paper-id="entry.paper_id"
          :highlight-pathname="`/papers/${entry.paper_id}`"
          @regenerate="(model: string) => openRegenDialog(model)"
          @delete-result="onDeleteResult"
        />
      </div>
      <div v-else-if="entry.status === 'running' || entry.status === 'pending'" class="py-4 text-center">
        <Loader2 class="h-5 w-5 mx-auto mb-2 animate-spin text-primary" />
        <p class="text-xs text-muted-foreground">正在生成回答...</p>
      </div>
      <div v-else-if="entry.status === 'failed'" class="py-4 text-center space-y-2">
        <p class="text-xs text-destructive">{{ entry.error || '生成失败' }}</p>
        <Button variant="link" size="xs" @click="openRegenDialog()">
          <RefreshCw />重试
        </Button>
      </div>
      <div v-else class="py-4 text-center text-xs text-muted-foreground">暂无回答</div>
    </div>
  </Card>

  <Dialog v-model:open="regenDialog.show">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>重新生成</DialogTitle>
        <DialogDescription class="truncate">{{ entry.prompt }}</DialogDescription>
      </DialogHeader>
      <div class="flex flex-wrap gap-1.5">
        <Button
          v-for="m in availableModels" :key="m.name"
          :variant="regenDialog.selectedModels.includes(m.name) ? 'secondary' : 'outline'"
          size="xs"
          @click="toggleRegenModel(m.name)"
        >
          {{ m.name }}
        </Button>
      </div>
      <DialogFooter>
        <Button variant="ghost" @click="regenDialog.show = false">取消</Button>
        <Button @click="submitRegen" :disabled="!regenDialog.selectedModels.length">
          <RefreshCw />提交
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
