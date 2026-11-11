<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQAStore } from '@/stores/qa'
import { useHighlightStore } from '@/stores/highlights'
import type { QAFeedEntry, QAResult } from '@paperland/shared'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import QAInputSummary from './QAInputSummary.vue'
import {
  CheckCircle2, Loader2, AlertCircle,
  RefreshCw, FileText, ChevronDown, User, Lock
} from '@lucide/vue'
import QAResultView from './QAResultView.vue'
import QAEntryBackgroundPicker from './QAEntryBackgroundPicker.vue'
import QAReadingIndicators from './QAReadingIndicators.vue'
import { qaEntryBackgroundClass } from './qa-entry-style'
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
const router = useRouter()

/** `QA-<id>`: copy a link to the entry (resolved by entry id). */
async function copyEntryLink() {
  const url = `paperland://paper/${props.entry.paper_id}?qa=${props.entry.entry_id}`
  await navigator.clipboard.writeText(`[QA-${props.entry.entry_id}](${url})`)
  toast.success(`QA-${props.entry.entry_id} link copied`, { position: 'bottom-center' })
}

/** The question box lives on the paper page: open it there with this answer as the follow-up target. */
function startFollowup(result: QAResult, prefill?: string) {
  if (result.status !== 'done') return
  const query: Record<string, string> = { qa: String(props.entry.entry_id), result: String(result.id), followup: '1' }
  if (prefill) query.fq = prefill
  router.push({ path: `/papers/${props.entry.paper_id}`, query })
}
const isOpen = ref(false)

// Models for the regenerate dialog come from the store (fetched once at the page level).
const availableModels = computed(() => store.availableModels)

// Load highlights only when the panel is expanded (mirrors paper-detail behavior).
watch(isOpen, (open) => {
  if (open) highlightStore.loadForPathname(`/papers/${props.entry.paper_id}`)
})

const isActive = computed(() => props.entry.status === 'running' || props.entry.status === 'pending')
const statusLabel = computed(() => {
  if (props.entry.status === 'done') return 'Done'
  if (props.entry.status === 'failed') return 'Generation failed'
  return 'Generating…'
})

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const regenDialog = ref<{ show: boolean; selectedModels: string[] }>({ show: false, selectedModels: [] })

function openRegenDialog(preselect?: string) {
  if (!props.entry.can_manage) return
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
  if (!props.entry.can_manage) return
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
  <article class="min-w-0">
    <!-- Paper title + time live ABOVE the card (outside it), keeping the card itself simple. -->
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0 px-1 mb-2.5">
      <router-link
        :to="`/papers/${entry.paper_id}`"
        class="group/paper flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
        :title="entry.paper_title"
      >
        <FileText class="h-3.5 w-3.5 shrink-0 text-primary/70" />
        <span class="truncate group-hover/paper:underline underline-offset-4">{{ entry.paper_title }}</span>
      </router-link>
      <!-- Asker display name (nickname → username) distinguishes entries whenever the viewer chooses all scope. -->
      <span
        v-if="store.feedScope === 'all' && entry.username"
        class="order-last flex w-full min-w-0 flex-wrap items-center gap-1 text-[11px] text-muted-foreground sm:order-none sm:w-auto sm:max-w-[30%]"
      >
        <User class="h-3 w-3 shrink-0" /><span class="min-w-0 break-words [overflow-wrap:anywhere]">{{ entry.display_name ?? entry.username }}</span>
        <!-- Owner's Q&A switch off: hidden from other non-admin users -->
        <span v-if="!entry.shared" class="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px]"><Lock class="h-2.5 w-2.5" />Private</span>
      </span>
      <time :datetime="entry.created_at" :title="new Date(entry.created_at).toLocaleString('en-US')" class="ml-auto shrink-0 text-[11px] text-muted-foreground tabular-nums">{{ formatDate(entry.created_at) }}</time>
    </div>

    <Collapsible v-model:open="isOpen">
      <Card class="overflow-hidden gap-0 rounded-xl py-0 ring-border shadow-xs transition-shadow hover:shadow-md" :class="[qaEntryBackgroundClass(entry.background_color), isOpen && 'ring-primary/25']">
        <CardHeader class="block p-0">
          <CollapsibleTrigger as-child>
            <button
              type="button"
              class="group/question flex w-full items-start gap-3 rounded-t-xl px-4 pt-4 pb-3 text-left cursor-pointer transition-colors hover:bg-foreground/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5 sm:pt-5"
            >
              <Tooltip>
                <TooltipTrigger as-child>
                  <span class="mt-0.5 shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-md" :class="entry.status === 'failed' ? 'bg-destructive/10' : isActive ? 'bg-primary/10' : 'bg-muted/70'" :aria-label="statusLabel">
                    <CheckCircle2 v-if="entry.status === 'done'" class="h-3.5 w-3.5 text-muted-foreground" />
                    <Loader2 v-else-if="isActive" class="h-4 w-4 text-primary animate-spin" />
                    <AlertCircle v-else-if="entry.status === 'failed'" class="h-4 w-4 text-destructive" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{{ statusLabel }}</TooltipContent>
              </Tooltip>

              <span class="flex-1 min-w-0 text-[15px] font-semibold leading-6 whitespace-pre-line [overflow-wrap:anywhere]" :class="!isOpen && 'line-clamp-3'">{{ entry.prompt || 'Free question' }}</span>
              <ChevronDown class="mt-1 h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform motion-reduce:transition-none group-hover/question:text-foreground" :class="isOpen && 'rotate-180'" aria-hidden="true" />
            </button>
          </CollapsibleTrigger>

          <div class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-4 text-muted-foreground sm:px-5 sm:pl-14">
            <Badge v-if="entry.results.length > 1" variant="secondary" class="h-auto min-h-5 max-w-full rounded-md px-2 py-0.5 text-[10px] font-medium whitespace-normal [overflow-wrap:anywhere]">{{ entry.results.length }} answers</Badge>
            <Badge v-else-if="entry.results.length === 1" variant="secondary" class="h-auto min-h-5 max-w-full rounded-md px-2 py-0.5 text-[10px] font-medium whitespace-normal [overflow-wrap:anywhere]">{{ entry.results[0].model_name }}</Badge>
            <span v-else class="text-[11px]">No answers yet</span>
            <span v-if="isActive" class="text-[11px] text-primary">Generating…</span>
            <QAInputSummary :inputs="entry.inputs" />
            <QAReadingIndicators class="flex-wrap" :highlight-count="entry.highlight_count" :note-anchor-count="entry.note_anchor_count" />
            <div class="ml-auto flex shrink-0 items-center gap-2">
              <Tooltip>
                <TooltipTrigger as-child>
                  <button
                    type="button" class="min-h-7 rounded px-1 text-[10px] text-muted-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    :aria-label="`Copy link to QA-${entry.entry_id}`" @click="copyEntryLink"
                  >QA-{{ entry.entry_id }}</button>
                </TooltipTrigger>
                <TooltipContent>Copy QA link</TooltipContent>
              </Tooltip>
              <QAEntryBackgroundPicker :entry-id="entry.entry_id" :color="entry.background_color" />
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <Separator />
          <CardContent class="px-4 py-5 sm:px-6 sm:py-6">
            <div v-if="entry.results.length > 0">
              <QAResultView
                :results="entry.results"
                :entry-key="`feed-${entry.entry_id}`"
                :paper-id="entry.paper_id"
                :highlight-pathname="`/papers/${entry.paper_id}`"
                :can-manage="entry.can_manage"
                @regenerate="(model: string) => openRegenDialog(model)"
                @delete-result="onDeleteResult"
                @cancel-result="store.cancelResult"
                @followup="startFollowup"
              />
            </div>
            <div v-else-if="isActive" class="py-4 text-center">
              <Loader2 class="h-5 w-5 mx-auto mb-2 animate-spin text-primary" />
              <p class="text-xs text-muted-foreground">Generating answer…</p>
            </div>
            <div v-else-if="entry.status === 'failed'" class="py-4 text-center space-y-2">
              <p class="text-xs text-destructive">{{ entry.error || 'Generation failed' }}</p>
              <Button v-if="entry.can_manage" variant="link" size="xs" @click="openRegenDialog()">
                <RefreshCw />Retry
              </Button>
            </div>
            <div v-else class="py-4 text-center text-xs text-muted-foreground">No answers yet</div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>

    <Dialog v-model:open="regenDialog.show">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Regenerate</DialogTitle>
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
          <Button variant="ghost" @click="regenDialog.show = false">Cancel</Button>
          <Button @click="submitRegen" :disabled="!regenDialog.selectedModels.length">
            <RefreshCw />Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </article>
</template>
