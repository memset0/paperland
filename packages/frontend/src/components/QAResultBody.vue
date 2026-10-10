<script setup lang="ts">
import { computed, ref } from 'vue'
import type { QAResult } from '@paperland/shared'
import { Check, ChevronRight, Copy, FileSearch, Link2, Loader2, MessagesSquare, PanelRightOpen, Pin, RefreshCw, Square, Telescope, Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'
import { useQAConversation } from '@/composables/useQAConversation'
import QAModelInputDialog from './QAModelInputDialog.vue'
import MarkdownContent from './MarkdownContent.vue'
import QAStreamingMarkdown from './QAStreamingMarkdown.vue'
import QAThinkingTimer from './QAThinkingTimer.vue'
import PaperRefList from './PaperRefList.vue'
import { extractCiteLinks } from '@/lib/cite-links'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const props = withDefaults(defineProps<{
  result: QAResult
  entryKey: string
  paperId: number
  highlightPathname?: string
  canManage?: boolean
  showModel?: boolean
  /** Rendered inside the conversation view (no "open in conversation" action). */
  inConversation?: boolean
}>(), { canManage: true, showModel: false, inConversation: false })

const emit = defineEmits<{
  regenerate: [modelName: string]
  deleteResult: [resultId: number]
  cancelResult: [resultId: number]
  /** Continue this answer; `prefill` comes from a suggested `#moonlight` follow-up. */
  followup: [result: QAResult, prefill?: string]
}>()

const auth = useAuthStore()
const conversation = useQAConversation()
const copied = ref(false)
const showModelInput = ref(false)
const refsOpen = ref(false)

/** This answer's own `#cite:` papers (distinct, first-appearance order); only for finished answers. */
const citeItems = computed(() =>
  props.result.status === 'done'
    ? extractCiteLinks(props.result.answer).map((link) => ({ id: link.id, fallback_text: link.text }))
    : [],
)

/** Copy a `paperland://` link to this answer (`?qa=<entry>&result=<id>`, resolved by ids). */
async function copyResultLink() {
  const url = `paperland://paper/${props.paperId}?qa=${props.result.qa_entry_id}&result=${props.result.id}`
  await navigator.clipboard.writeText(`[QA-${props.result.qa_entry_id} · ${props.result.model_name}](${url})`)
  toast.success('Answer link copied', { position: 'bottom-center' })
}

function onMoonlight(question: string) {
  if (!auth.isAuthenticated) return
  emit('followup', props.result, question)
}

function pinKey() { return `qa-pin-${props.paperId}-${props.entryKey}` }
function isPinned() { return localStorage.getItem(pinKey()) === props.result.model_name }
function togglePin() {
  if (isPinned()) localStorage.removeItem(pinKey())
  else localStorage.setItem(pinKey(), props.result.model_name)
}

async function copyAnswer() {
  await navigator.clipboard.writeText(props.result.answer)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function statusLabel(): string {
  if (props.result.status === 'queued') return 'Queued'
  if (props.result.status === 'awaiting_output') return 'Thinking'
  if (props.result.status === 'streaming') return 'Streaming'
  if (props.result.status === 'done') return 'Done'
  if (props.result.status === 'cancelled') return 'Stopped'
  return 'Failed'
}

function timeAgo(iso: string): string {
  const time = Date.parse(iso)
  if (!Number.isFinite(time)) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
</script>

<template>
  <div class="qa-result-body" :data-result-status="result.status">
    <div class="mb-3 flex min-h-6 items-center gap-2">
      <Badge variant="secondary" class="shrink-0">{{ statusLabel() }}</Badge>
      <Badge v-if="showModel" variant="outline" class="max-w-56 truncate">{{ result.model_name }}</Badge>
      <QAThinkingTimer :status="result.status" :duration-ms="result.thinking_duration_ms" />
      <span v-if="result.status === 'awaiting_output' && !result.streaming_capable" class="text-xs text-muted-foreground">
        This model will display its answer when complete
      </span>
      <span v-if="result.status === 'done'" class="ml-auto text-[10px] text-muted-foreground">
        {{ timeAgo(result.finished_at || result.completed_at) }}
      </span>
    </div>

    <div v-if="result.status === 'queued' && !result.answer" class="flex min-h-20 items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 class="h-4 w-4 animate-spin" />Waiting for an available slot…
    </div>
    <div v-else-if="result.status === 'awaiting_output' && !result.answer" class="flex min-h-20 items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 class="h-4 w-4 animate-spin" />Agent is thinking…
    </div>
    <MarkdownContent
      v-else-if="result.status === 'done'"
      :content="result.answer"
      :highlight-pathname="highlightPathname"
      :paper-id="paperId"
      :qa-result-id="result.id"
      qa-answer
      class="text-sm"
      @moonlight="onMoonlight"
    />
    <QAStreamingMarkdown v-else-if="result.answer" :content="result.answer" />

    <Collapsible v-if="citeItems.length" v-model:open="refsOpen" class="mt-3">
      <CollapsibleTrigger class="flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ChevronRight class="h-3.5 w-3.5 transition-transform" :class="refsOpen ? 'rotate-90' : ''" />
        References · {{ citeItems.length }}
      </CollapsibleTrigger>
      <CollapsibleContent class="pt-2">
        <PaperRefList v-if="refsOpen" :items="citeItems" />
      </CollapsibleContent>
    </Collapsible>

    <div v-if="result.status === 'failed' || result.status === 'cancelled'" class="mt-3 rounded-md bg-destructive/5 px-3 py-2 text-xs text-destructive">
      {{ result.error || (result.status === 'cancelled' ? 'Generation stopped' : 'Generation failed') }}
    </div>

    <Separator class="my-3" />
    <div class="flex min-h-7 items-center gap-1">
      <Tooltip v-if="result.status === 'done'">
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon-xs" :class="isPinned() ? 'text-primary' : ''" @click="togglePin">
            <Pin />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ isPinned() ? 'Unpin' : 'Pin' }}</TooltipContent>
      </Tooltip>
      <Tooltip v-if="result.answer">
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon-xs" @click="copyAnswer">
            <Check v-if="copied" /><Copy v-else />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ copied ? 'Copied' : 'Copy' }}</TooltipContent>
      </Tooltip>
      <Tooltip v-if="auth.isAuthenticated">
        <TooltipTrigger as-child>
          <Button
            variant="ghost" size="icon-xs"
            :disabled="result.status !== 'done'"
            @click="emit('followup', result)"
          >
            <MessagesSquare />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ result.status === 'done' ? 'Follow up' : 'Available after the answer finishes' }}</TooltipContent>
      </Tooltip>
      <Tooltip v-if="conversation.available.value && !inConversation">
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon-xs" @click="conversation.openThread(result.qa_entry_id, result.id)">
            <PanelRightOpen />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open in conversation view</TooltipContent>
      </Tooltip>
      <Tooltip v-if="auth.isAuthenticated && result.status === 'done'">
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon-xs" as-child>
            <RouterLink :to="{ path: '/research', query: { new: '1', seed_result: String(result.id) } }">
              <Telescope />
            </RouterLink>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Deep Research from this answer</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon-xs" @click="copyResultLink">
            <Link2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy answer link</TooltipContent>
      </Tooltip>
      <Tooltip v-if="auth.isAuthenticated">
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon-xs" @click="showModelInput = true">
            <FileSearch />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View model input</TooltipContent>
      </Tooltip>
      <Tooltip v-if="result.can_cancel">
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon-xs" class="hover:text-destructive" @click="emit('cancelResult', result.id)">
            <Square />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Stop this run</TooltipContent>
      </Tooltip>
      <Tooltip v-if="canManage && ['done', 'failed', 'cancelled'].includes(result.status)">
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon-xs" @click="emit('regenerate', result.model_name)">
            <RefreshCw />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Regenerate</TooltipContent>
      </Tooltip>
      <Tooltip v-if="canManage && ['done', 'failed', 'cancelled'].includes(result.status)">
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon-xs" class="hover:text-destructive" @click="emit('deleteResult', result.id)">
            <Trash2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete</TooltipContent>
      </Tooltip>
    </div>
    <QAModelInputDialog v-if="auth.isAuthenticated" v-model:open="showModelInput" :result-id="result.id" />
  </div>
</template>

<style scoped>
.qa-result-body {
  overflow-anchor: auto;
}
</style>
