<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useQAStore } from '@/stores/qa'
import { useAuthStore } from '@/stores/auth'
import { useLoginPrompt } from '@/composables/useLoginPrompt'
import { useQAWindow } from '@/composables/useQAWindow'
import FloatingWindow from './FloatingWindow.vue'
import { useQAComposer, inputPageLabel } from '@/composables/useQAComposer'
import { useQAConversation } from '@/composables/useQAConversation'
import { usePapersStore } from '@/stores/papers'
import { NO_QA_CONTENT_HINT, paperHasQAContent } from '@/lib/qa-content'
import { api } from '@/api/client'
import { Send, LogIn, X, TextQuote, Image as ImageIcon, MessagesSquare } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'

const props = defineProps<{
  paperId: number
  /** Docked at the bottom of the conversation view instead of floating. */
  docked?: boolean
  /** Why asking is unavailable right now (e.g. the thread's last answer is still running). */
  blocked?: string | null
}>()
const store = useQAStore()
const auth = useAuthStore()
const { openLogin } = useLoginPrompt()
const { win, close } = useQAWindow()
const isMobile = useMediaQuery('(max-width: 768px)')
const composer = useQAComposer()
const conversation = useQAConversation()
const question = composer.question
const availableModels = ref<Array<{ name: string; vision?: boolean }>>([])
const textareaRef = ref<InstanceType<typeof Textarea> | null>(null)

function textareaEl(): HTMLTextAreaElement | null {
  const el = (textareaRef.value as any)?.$el ?? textareaRef.value
  return el instanceof HTMLTextAreaElement ? el : (el?.querySelector?.('textarea') ?? null)
}

/** Insert text at the caret (used when attachments are added and by the @ menu). */
function insertAtCursor(text: string, replaceBefore = 0) {
  const el = textareaEl()
  const value = question.value
  const start = el ? el.selectionStart : value.length
  const end = el ? el.selectionEnd : value.length
  const from = Math.max(0, start - replaceBefore)
  question.value = value.slice(0, from) + text + value.slice(end)
  void nextTick(() => {
    const caret = from + text.length
    el?.focus()
    el?.setSelectionRange(caret, caret)
  })
}

// --- @ completion: typing `@` lists every referenceable input (ancestors + attachments) ---
const mention = ref<{ query: string; index: number } | null>(null)
const mentionItems = computed(() => {
  if (!mention.value) return []
  const q = mention.value.query.toLowerCase()
  return composer.referenceables().filter((input) => input.label.toLowerCase().startsWith(q))
})
function updateMention() {
  const el = textareaEl()
  if (!el) return
  const before = question.value.slice(0, el.selectionStart)
  const match = /(?:^|\s)@([A-Za-z0-9]*)$/.exec(before)
  mention.value = match && composer.referenceables().length ? { query: match[1], index: 0 } : null
}
function pickMention(label: string) {
  insertAtCursor(`@${label} `, (mention.value?.query.length ?? 0) + 1)
  mention.value = null
}
function onKeydown(e: KeyboardEvent) {
  if (mention.value && mentionItems.value.length) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const n = mentionItems.value.length
      mention.value.index = (mention.value.index + (e.key === 'ArrowDown' ? 1 : n - 1)) % n
      return
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      pickMention(mentionItems.value[mention.value.index].label)
      return
    }
    if (e.key === 'Escape') { mention.value = null; return }
  }
  if (e.key === 'Enter' && e.ctrlKey) submit()
}

function preview(input: { kind: string; text?: string }): string {
  return input.kind === 'text_selection' ? (input.text ?? '').replace(/\s+/g, ' ').slice(0, 40) : ''
}

const papers = usePapersStore()
/** Q&A needs the paper's full text (parsed PDF or user content); the backend answers 409 otherwise. */
const noContent = computed(() => {
  const paper = papers.currentPaper
  return !!paper && paper.id === props.paperId && !paperHasQAContent(paper)
})

/** Images go to every selected model, so each must accept image input. */
const nonVisionSelected = computed(() => composer.hasImage()
  ? store.selectedModels.filter((name) => !availableModels.value.find((m) => m.name === name)?.vision)
  : [])

onBeforeUnmount(() => composer.registerInserter(null))
watch(() => [auth.user?.id, props.paperId] as const, ([userId, paperId]) => composer.bind(userId, paperId), { immediate: true })

onMounted(async () => {
  composer.registerInserter((text) => insertAtCursor(text))
  if (!auth.isAuthenticated) return // models endpoint requires login; anon sees a login prompt
  try {
    const res = await api.get<{ models: { available: Array<{ name: string }> } }>('/api/config/models')
    availableModels.value = res.models.available
  } catch {
    availableModels.value = [{ name: 'gpt-4o' }]
  }
  const names = availableModels.value.map(m => m.name)
  // One model per question: keep the first still-available cached model, else the first model.
  const valid = store.selectedModels.find(m => names.includes(m)) ?? names[0]
  store.selectedModels = valid ? [valid] : []
})

async function submit() {
  if (!auth.isAuthenticated) { openLogin(); return }
  if (!question.value.trim() || !store.selectedModels.length || nonVisionSelected.value.length || noContent.value || props.blocked) return
  const res = await store.submitFreeQuestion(props.paperId, question.value.trim(), store.selectedModels, {
    inputs: composer.requestInputs(),
  })
  if (!res) return // cancelled at the doc2x confirmation
  composer.reset()
  // In the conversation view the active tab follows the new answer.
  const run = res.runs[0]
  if (props.docked && run) conversation.setActiveTail(res.entry_id, run.result_id)
}

/** Model buttons are a single choice: picking a model replaces the selection. */
function selectModel(name: string) {
  store.selectedModels = [name]
}
</script>

<template>
  <!-- Floating: the shared FloatingWindow shell in its bare look (this card IS the window; drag
       empty card areas to move, bottom-right grip to resize). Docked: a plain block. -->
  <component
    :is="docked ? 'div' : FloatingWindow"
    v-if="docked || win"
    v-bind="docked ? { class: 'h-full' } : { win, bare: true, minWidth: 300, minHeight: 120 }"
  >
  <Card
    size="sm"
    :class="docked
      ? 'relative flex h-full flex-col rounded-none border-0 border-t px-3 shadow-none ring-0'
      : ['flex h-full flex-1 flex-col px-2.5 md:px-3 shadow-2xl', isMobile ? 'rounded-none' : 'rounded-lg']"
  >
    <template v-if="auth.isAuthenticated">
      <!-- Top row: Submit (left) · model selector · Close (top-right) -->
      <div class="flex items-center gap-1.5 shrink-0">
        <Button
          @click="submit"
          :disabled="!question.trim() || !store.selectedModels.length || store.submitting || nonVisionSelected.length > 0 || noContent || !!blocked"
          size="sm"
          class="gap-1.5 shrink-0"
        >
          <Send /> Submit
        </Button>
        <div class="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          <span class="text-[10px] text-muted-foreground uppercase tracking-wider mr-0.5">模型</span>
          <!-- Docked in the narrow conversation column: one compact dropdown instead of a button row -->
          <select
            v-if="docked"
            :value="store.selectedModels[0] ?? ''"
            class="h-6 min-w-0 flex-1 rounded-md border bg-background px-1.5 text-xs"
            data-qa-model-select
            @change="selectModel(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="m in availableModels" :key="m.name" :value="m.name">{{ m.name }}</option>
          </select>
          <template v-else>
            <Button
              v-for="m in availableModels" :key="m.name"
              :variant="store.selectedModels.includes(m.name) ? 'secondary' : 'outline'"
              size="xs"
              @click="selectModel(m.name)"
            >
              {{ m.name }}
            </Button>
          </template>
        </div>
        <Button v-if="!docked" variant="ghost" size="icon-sm" class="shrink-0" title="关闭" @click="close()">
          <X />
        </Button>
      </div>
      <!-- Follow-up target and attachments sit between the controls and the input -->
      <div v-if="composer.followup.value" class="flex items-center gap-1.5 shrink-0 text-[11px] text-muted-foreground">
        <MessagesSquare class="h-3 w-3 shrink-0" />
        <span class="truncate">追问 QA-{{ composer.followup.value.entry_id }} · {{ composer.followup.value.model_name }} · {{ composer.followup.value.title }}</span>
        <button v-if="!docked" type="button" class="ml-auto shrink-0 hover:text-foreground" title="取消追问" @click="composer.clearFollowup()">
          <X class="h-3 w-3" />
        </button>
      </div>
      <div v-if="composer.attachments.value.length" class="flex items-center gap-1 shrink-0 overflow-x-auto pb-0.5">
        <span
          v-for="input in composer.attachments.value" :key="input.label"
          class="inline-flex max-w-56 shrink-0 items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px]"
          :title="input.kind === 'text_selection' ? input.text : input.label"
        >
          <TextQuote v-if="input.kind === 'text_selection'" class="h-3 w-3 shrink-0 text-muted-foreground" />
          <ImageIcon v-else class="h-3 w-3 shrink-0 text-muted-foreground" />
          <span class="font-medium">@{{ input.label }}</span>
          <img v-if="input.kind === 'image'" :src="input.url" alt="" class="h-4 w-6 shrink-0 rounded-sm object-cover" />
          <span v-else class="truncate text-muted-foreground">{{ preview(input) }}</span>
          <span v-if="inputPageLabel(input)" class="shrink-0 text-muted-foreground">{{ inputPageLabel(input) }}</span>
          <button type="button" class="shrink-0 text-muted-foreground hover:text-foreground" title="移除" @click="composer.removeAttachment(input.label)">
            <X class="h-3 w-3" />
          </button>
        </span>
      </div>
      <p v-if="docked && !composer.followup.value && !blocked" class="shrink-0 text-[11px] text-muted-foreground">新对话：提交后创建新的提问</p>
      <p v-if="blocked" class="shrink-0 text-[11px] text-muted-foreground">{{ blocked }}</p>
      <p v-if="noContent" class="shrink-0 text-[11px] text-muted-foreground">{{ NO_QA_CONTENT_HINT }}</p>
      <p v-if="nonVisionSelected.length" class="shrink-0 text-[11px] text-destructive">
        {{ nonVisionSelected.join(', ') }} 不支持图片输入，请换用支持图片的模型
      </p>
      <div class="relative flex flex-1 min-h-0">
        <Textarea
          ref="textareaRef"
          v-model="question"
          @keydown="onKeydown"
          @input="updateMention"
          @click="updateMention"
          @blur="mention = null"
          placeholder="输入问题，@ 引用选段或截图..."
          rows="2"
          class="flex-1 min-h-0 w-full resize-none"
        />
        <div
          v-if="mention && mentionItems.length"
          class="absolute bottom-full left-0 z-10 mb-1 max-h-48 w-64 overflow-y-auto rounded-md border bg-popover p-1 text-xs shadow-md"
        >
          <button
            v-for="(input, i) in mentionItems" :key="input.label"
            type="button"
            class="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left"
            :class="i === mention.index ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'"
            @mousedown.prevent="pickMention(input.label)"
          >
            <TextQuote v-if="input.kind === 'text_selection'" class="h-3 w-3 shrink-0" />
            <ImageIcon v-else class="h-3 w-3 shrink-0" />
            <span class="font-medium">@{{ input.label }}</span>
            <span class="truncate text-muted-foreground">{{ input.kind === 'text_selection' ? preview(input) : '截图' }}</span>
            <span v-if="inputPageLabel(input)" class="ml-auto shrink-0 text-muted-foreground">{{ inputPageLabel(input) }}</span>
          </button>
        </div>
      </div>
    </template>
    <div v-else class="flex items-center gap-2 shrink-0">
      <button
        type="button"
        class="flex flex-1 items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground"
        @click="openLogin()"
      >
        <LogIn class="h-4 w-4" /> 登录后可对论文提问
      </button>
      <Button variant="ghost" size="icon-sm" class="shrink-0" title="关闭" @click="close()">
        <X />
      </Button>
    </div>

  </Card>
  </component>
</template>
