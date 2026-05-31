<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQAStore } from '@/stores/qa'
import { useHighlightStore } from '@/stores/highlights'
import type { QAFeedEntry } from '@paperland/shared'
import {
  CheckCircle2, Loader2, AlertCircle,
  RefreshCw, ExternalLink
} from '@lucide/vue'
import QAResultView from './QAResultView.vue'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

const props = defineProps<{ entry: QAFeedEntry }>()
const emit = defineEmits<{ refresh: [] }>()

const store = useQAStore()
const highlightStore = useHighlightStore()
const isOpen = ref(false)

// Models for the regenerate dialog come from the store (fetched once at the page level).
const availableModels = computed(() => store.availableModels)

// Load highlights only when the panel is expanded (mirrors paper-detail behavior).
watch(isOpen, (open) => {
  if (open) highlightStore.loadForPathname(`/papers/${props.entry.paper_id}`)
})

const isActive = computed(() => props.entry.status === 'running' || props.entry.status === 'pending')
const statusLabel = computed(() => {
  if (props.entry.status === 'done') return '已完成'
  if (props.entry.status === 'failed') return '生成失败'
  return '生成中'
})

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
  <div>
    <!-- Paper title + time live ABOVE the card (outside it), keeping the card itself simple. -->
    <div class="flex items-center gap-2 min-w-0 px-1 mb-1.5">
      <router-link
        :to="`/papers/${entry.paper_id}`"
        class="min-w-0 truncate text-xs text-primary hover:underline"
      >
        <ExternalLink class="h-3 w-3 inline mr-0.5 -mt-0.5" />{{ entry.paper_title }}
      </router-link>
      <span class="ml-auto shrink-0 text-[10px] text-muted-foreground">{{ formatDate(entry.created_at) }}</span>
    </div>

    <Collapsible v-model:open="isOpen">
      <Card class="overflow-hidden gap-0 py-0 transition-shadow hover:shadow-sm">
        <CollapsibleTrigger as-child>
          <CardHeader
            role="button"
            tabindex="0"
            class="flex flex-row items-center gap-3 px-5 py-3.5 cursor-pointer select-none rounded-none text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            @keydown.enter.prevent="isOpen = !isOpen"
            @keydown.space.prevent="isOpen = !isOpen"
          >
            <Tooltip>
              <TooltipTrigger as-child>
                <span class="shrink-0 inline-flex">
                  <CheckCircle2 v-if="entry.status === 'done'" class="h-4 w-4 text-muted-foreground" />
                  <Loader2 v-else-if="isActive" class="h-4 w-4 text-primary animate-spin" />
                  <AlertCircle v-else-if="entry.status === 'failed'" class="h-4 w-4 text-destructive" />
                </span>
              </TooltipTrigger>
              <TooltipContent>{{ statusLabel }}</TooltipContent>
            </Tooltip>

            <p class="flex-1 min-w-0 text-sm font-semibold line-clamp-1">{{ entry.prompt || '自由提问' }}</p>

            <div class="flex items-center gap-2 shrink-0">
              <Badge v-if="entry.results.length > 1" variant="secondary">{{ entry.results.length }} 个回答</Badge>
              <Badge v-else-if="entry.results.length === 1" variant="secondary">{{ entry.results[0].model_name }}</Badge>
              <span v-if="isActive" class="text-[10px] text-primary">生成中...</span>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Separator />
          <CardContent class="px-5 py-4">
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
            <div v-else-if="isActive" class="py-4 text-center">
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
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>

    <Dialog v-model:open="regenDialog.show">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>重新生成</DialogTitle>
          <DialogDescription class="truncate">{{ entry.prompt }}</DialogDescription>
        </DialogHeader>
        <div class="space-y-2.5 max-h-60 overflow-y-auto">
          <div v-for="m in availableModels" :key="m.name" class="flex items-center gap-2.5">
            <Checkbox
              :id="`regen-${entry.entry_id}-${m.name}`"
              :model-value="regenDialog.selectedModels.includes(m.name)"
              @update:model-value="() => toggleRegenModel(m.name)"
            />
            <Label :for="`regen-${entry.entry_id}-${m.name}`" class="cursor-pointer text-sm font-normal">{{ m.name }}</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="regenDialog.show = false">取消</Button>
          <Button @click="submitRegen" :disabled="!regenDialog.selectedModels.length">
            <RefreshCw />提交
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
