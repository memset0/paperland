<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { QAFeedEntry, QAInput, QAResult, QATreeNode } from '@paperland/shared'
import { Loader2, TextQuote, EyeOff } from '@lucide/vue'
import { api } from '@/api/client'
import { useQAStore } from '@/stores/qa'
import { useQAComposer, inputPageLabel } from '@/composables/useQAComposer'
import { useBlockAnchor } from '@/composables/useBlockAnchor'
import { usePdfNavigation } from '@/composables/usePdfNavigation'
import QAResultBody from './QAResultBody.vue'

/**
 * One derived conversation thread: the answer `resultId` of entry `entryId` plus every ancestor
 * question and the specific ancestor answer each step continued, rendered root → tail as chat
 * messages. Content comes from the live Q&A store when the entry is loaded there (so streaming
 * answers grow in place), else from the follow-up tree snapshot.
 */
const props = defineProps<{ paperId: number; entryId: number; resultId: number }>()
const emit = defineEmits<{
  /** The tail answer as currently known (null while the thread is loading or the answer is gone). */
  tail: [info: { entry_id: number; result_id: number; title: string; model_name: string; status: QAResult['status'] } | null]
}>()

const store = useQAStore()
const composer = useQAComposer()
const { revealQAEntry } = useBlockAnchor()
const { requestPdfNavigation } = usePdfNavigation()

interface Step {
  entryId: number
  resultId: number
  state: QATreeNode['state']
  snapshot: QAFeedEntry | null
}

const steps = ref<Step[]>([])
const loading = ref(false)
const failed = ref(false)
const scrollRef = ref<HTMLElement | null>(null)

/** Path root → target in a follow-up tree, or null when the target isn't in it. */
function findPath(node: QATreeNode, entryId: number): QATreeNode[] | null {
  if (node.entry_id === entryId) return [node]
  for (const child of node.children) {
    const below = findPath(child, entryId)
    if (below) return [node, ...below]
  }
  return null
}

let loadToken = 0
async function load() {
  const token = ++loadToken
  loading.value = true
  failed.value = false
  try {
    const tree = await api.get<{ data: QATreeNode }>(`/api/qa/entries/${props.entryId}/tree`)
    if (token !== loadToken) return
    const path = findPath(tree.data, props.entryId) ?? []
    steps.value = path.map((node, i) => ({
      entryId: node.entry_id,
      // Each ancestor shows the answer its child continued; the tail shows the chosen answer.
      resultId: i < path.length - 1 ? (path[i + 1].parent_result_id ?? -1) : props.resultId,
      state: node.state,
      snapshot: node.entry,
    }))
  } catch {
    if (token !== loadToken) return
    steps.value = []
    failed.value = true
  } finally {
    if (token === loadToken) loading.value = false
  }
  await nextTick()
  scrollToBottom()
}

watch(() => [props.entryId, props.resultId], load, { immediate: true })

/** The live store copy of an entry (templates and user Q&A of the current paper/scope). */
function liveEntry(entryId: number): { prompt: string | null; templateName: string | null; results: QAResult[]; inputs: QAInput[] } | null {
  for (const [name, entry] of Object.entries(store.qaData.template)) {
    if (entry.entry_id === entryId) return { prompt: null, templateName: name, results: entry.results, inputs: entry.inputs }
  }
  const free = store.qaData.free.find((entry) => entry.entry_id === entryId)
  return free ? { prompt: free.prompt, templateName: null, results: free.results, inputs: free.inputs } : null
}

interface Message {
  entryId: number
  hidden: boolean
  question: string
  inputs: QAInput[]
  result: QAResult | null
  entryKey: string
}

const messages = computed<Message[]>(() => steps.value.map((step) => {
  const live = liveEntry(step.entryId)
  const results = live?.results ?? step.snapshot?.results ?? []
  const result = results.find((candidate) => candidate.id === step.resultId) ?? null
  const templatePrompt = live?.templateName ? store.templates.find((t) => t.name === live.templateName)?.prompt : null
  return {
    entryId: step.entryId,
    hidden: step.state !== 'visible' && !live,
    question: live?.prompt || templatePrompt || step.snapshot?.prompt || result?.prompt || `QA-${step.entryId}`,
    inputs: (live?.inputs ?? step.snapshot?.inputs ?? []).filter((input) => input.kind !== 'history'),
    result,
    entryKey: live?.templateName ? `tmpl-${live.templateName}` : `free-${step.entryId}`,
  }
}))

const tailMessage = computed(() => {
  const last = messages.value[messages.value.length - 1]
  return last && last.entryId === props.entryId ? last : null
})

watch(
  () => {
    const tail = tailMessage.value
    return tail?.result ? `${tail.entryId}:${tail.result.id}:${tail.result.status}:${tail.result.model_name}` : ''
  },
  () => {
    const tail = tailMessage.value
    emit('tail', tail?.result
      ? { entry_id: tail.entryId, result_id: tail.result.id, title: tail.question, model_name: tail.result.model_name, status: tail.result.status }
      : null)
  },
  { immediate: true },
)

// Keep following a streaming tail while the user stays near the bottom.
function nearBottom(): boolean {
  const el = scrollRef.value
  return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120
}
function scrollToBottom() {
  const el = scrollRef.value
  if (el) el.scrollTop = el.scrollHeight
}
watch(() => tailMessage.value?.result?.answer.length ?? 0, async () => {
  if (!nearBottom()) return
  await nextTick()
  scrollToBottom()
})

function preview(text: string): string {
  return text.replace(/\s+/g, ' ').slice(0, 80)
}

function jumpToInput(input: QAInput) {
  if (input.kind === 'text_selection' && input.pdf[0]) requestPdfNavigation({ page: input.pdf[0].page, ts: input.pdf[0].ts, te: input.pdf[0].te })
  else if (input.kind === 'image' && input.pdf) requestPdfNavigation({ page: input.pdf.page, rect: { x: input.pdf.rx, y: input.pdf.ry, w: input.pdf.rw, h: input.pdf.rh } })
}

function onFollowup(message: Message, result: QAResult, prefill?: string) {
  if (result.status !== 'done') return
  void composer.startFollowup({ result_id: result.id, entry_id: message.entryId, title: message.question, model_name: result.model_name }, prefill)
}
</script>

<template>
  <div ref="scrollRef" class="h-full overflow-y-auto px-4 py-4">
    <div v-if="loading && !steps.length" class="flex items-center justify-center py-10 text-muted-foreground">
      <Loader2 class="h-4 w-4 animate-spin" />
    </div>
    <p v-else-if="failed" class="py-10 text-center text-xs text-muted-foreground">无法加载该对话（问答不存在或不可见）</p>
    <div v-else class="space-y-5">
      <template v-for="message in messages" :key="message.entryId">
        <div v-if="message.hidden" class="flex items-center justify-center gap-1.5 rounded-md border border-dashed py-3 text-xs text-muted-foreground">
          <EyeOff class="h-3.5 w-3.5" /> QA-{{ message.entryId }} 当前不可见或已删除
        </div>
        <template v-else>
          <!-- Question (user message) -->
          <div class="flex justify-end" :data-conv-entry="message.entryId">
            <div class="max-w-[88%] rounded-2xl rounded-br-sm bg-muted px-3.5 py-2.5 text-sm">
              <div v-if="message.inputs.length" class="mb-1.5 flex flex-wrap gap-1">
                <button
                  v-for="input in message.inputs" :key="input.kind === 'history' ? 'h' : input.label"
                  type="button"
                  class="inline-flex max-w-full items-center gap-1 rounded-md border bg-background/70 px-1.5 py-0.5 text-[11px] hover:bg-background"
                  :title="input.kind === 'text_selection' ? input.text : (input.kind === 'image' ? input.label : '')"
                  @click="jumpToInput(input)"
                >
                  <template v-if="input.kind === 'text_selection'">
                    <TextQuote class="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span class="font-medium">@{{ input.label }}</span>
                    <span class="truncate text-muted-foreground">{{ preview(input.text) }}</span>
                  </template>
                  <template v-else-if="input.kind === 'image'">
                    <img :src="input.url" alt="" class="h-8 w-12 shrink-0 rounded-sm object-cover" />
                    <span class="font-medium">@{{ input.label }}</span>
                  </template>
                  <span v-if="input.kind !== 'history' && inputPageLabel(input)" class="shrink-0 text-muted-foreground">{{ inputPageLabel(input) }}</span>
                </button>
              </div>
              <p class="whitespace-pre-wrap break-words">{{ message.question }}</p>
              <button
                type="button"
                class="mt-1 block w-full text-right text-[10px] text-muted-foreground hover:text-foreground"
                title="在列表中定位"
                @click="revealQAEntry(message.entryId, message.result?.id ?? null)"
              >QA-{{ message.entryId }}</button>
            </div>
          </div>
          <!-- Answer (assistant message) -->
          <div v-if="message.result" class="min-w-0">
            <QAResultBody
              :result="message.result"
              :entry-key="message.entryKey"
              :paper-id="paperId"
              :can-manage="false"
              :show-model="true"
              in-conversation
              @cancel-result="store.cancelResult"
              @followup="(result, prefill) => onFollowup(message, result, prefill)"
            />
          </div>
          <p v-else class="text-xs text-muted-foreground">该回答已删除</p>
        </template>
      </template>
    </div>
  </div>
</template>
