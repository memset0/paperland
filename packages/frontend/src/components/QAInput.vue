<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useQAStore } from '@/stores/qa'
import { useAuthStore } from '@/stores/auth'
import { useLoginPrompt } from '@/composables/useLoginPrompt'
import { useQAWindow } from '@/composables/useQAWindow'
import { useQAComposer, inputPageLabel } from '@/composables/useQAComposer'
import { usePapersStore } from '@/stores/papers'
import { NO_QA_CONTENT_HINT, paperHasQAContent } from '@/lib/qa-content'
import { api } from '@/api/client'
import { Send, LogIn, X, TextQuote, Image as ImageIcon, MessagesSquare } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'

const props = defineProps<{ paperId: number }>()
const store = useQAStore()
const auth = useAuthStore()
const { openLogin } = useLoginPrompt()
const { isOpen, left, top, width, height, close, setGeometry } = useQAWindow()
const isMobile = useMediaQuery('(max-width: 768px)')
const composer = useQAComposer()
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

// Desktop: a top-left anchored fixed card of the computed geometry (resizable).
// Mobile: a fullscreen overlay (inset-0 via class). z-index sits at the notes-window
// level (200) so it covers the launcher FAB and page chrome.
const style = computed(() =>
  isMobile.value
    ? { zIndex: 200 }
    : { left: left.value + 'px', top: top.value + 'px', width: width.value + 'px', height: height.value + 'px', zIndex: 200 },
)

// --- Move: drag any empty area of the card (not the textarea / buttons / grip) ---
let moving = false, mx = 0, my = 0, ml = 0, mt = 0
function onCardDown(e: PointerEvent) {
  if (isMobile.value) return
  const t = e.target as HTMLElement
  if (t.closest('button, textarea, a, input, label, [data-qa-resize]')) return
  moving = true
  mx = e.clientX; my = e.clientY; ml = left.value; mt = top.value
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onCardMove(e: PointerEvent) {
  if (!moving) return
  setGeometry({ left: ml + (e.clientX - mx), top: Math.max(0, mt + (e.clientY - my)) })
}
function onCardUp(e: PointerEvent) {
  moving = false
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
}

// --- Resize: bottom-right grip changes the panel size ---
let resizing = false, rx = 0, ry = 0, rw = 0, rh = 0
function onResizeDown(e: PointerEvent) {
  resizing = true
  rx = e.clientX; ry = e.clientY; rw = width.value; rh = height.value
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onResizeMove(e: PointerEvent) {
  if (!resizing) return
  setGeometry({
    width: Math.max(300, rw + (e.clientX - rx)),
    height: Math.max(120, rh + (e.clientY - ry)),
  })
}
function onResizeUp(e: PointerEvent) {
  resizing = false
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
}

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
  const valid = store.selectedModels.filter(m => names.includes(m))
  if (valid.length) {
    store.selectedModels = valid
  } else if (names.length) {
    store.selectedModels = [names[0]]
  }
})

async function submit() {
  if (!auth.isAuthenticated) { openLogin(); return }
  if (!question.value.trim() || !store.selectedModels.length || nonVisionSelected.value.length || noContent.value) return
  const res = await store.submitFreeQuestion(props.paperId, question.value.trim(), store.selectedModels, {
    inputs: composer.requestInputs(),
  })
  if (res) composer.reset() // undefined = cancelled at the doc2x confirmation
}

function toggleModel(name: string) {
  if (store.selectedModels.includes(name)) {
    store.selectedModels = store.selectedModels.filter(x => x !== name)
  } else {
    store.selectedModels.push(name)
  }
}
</script>

<template>
  <Card
    v-if="isOpen"
    size="sm"
    :style="style"
    :class="['fixed flex flex-col px-2.5 md:px-3 shadow-2xl', isMobile ? 'inset-0 rounded-none' : 'rounded-lg cursor-move']"
    @pointerdown="onCardDown"
    @pointermove="onCardMove"
    @pointerup="onCardUp"
  >
    <template v-if="auth.isAuthenticated">
      <!-- Top row: Submit (left) · model selector · Close (top-right) -->
      <div class="flex items-center gap-1.5 shrink-0">
        <Button
          @click="submit"
          :disabled="!question.trim() || !store.selectedModels.length || store.submitting || nonVisionSelected.length > 0 || noContent"
          size="sm"
          class="gap-1.5 shrink-0"
        >
          <Send /> Submit
        </Button>
        <div class="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          <span class="text-[10px] text-muted-foreground uppercase tracking-wider mr-0.5">模型</span>
          <Button
            v-for="m in availableModels" :key="m.name"
            :variant="store.selectedModels.includes(m.name) ? 'secondary' : 'outline'"
            size="xs"
            @click="toggleModel(m.name)"
          >
            {{ m.name }}
          </Button>
        </div>
        <Button variant="ghost" size="icon-sm" class="shrink-0" title="关闭" @click="close()">
          <X />
        </Button>
      </div>
      <!-- Follow-up target and attachments sit between the controls and the input -->
      <div v-if="composer.followup.value" class="flex items-center gap-1.5 shrink-0 text-[11px] text-muted-foreground">
        <MessagesSquare class="h-3 w-3 shrink-0" />
        <span class="truncate">追问 QA-{{ composer.followup.value.entry_id }} · {{ composer.followup.value.model_name }} · {{ composer.followup.value.title }}</span>
        <button type="button" class="ml-auto shrink-0 hover:text-foreground" title="取消追问" @click="composer.clearFollowup()">
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

    <!-- Bottom-right grip: drag to RESIZE the panel (desktop only). The textarea
         itself is not resizable; the panel is moved by dragging empty card areas. -->
    <div
      v-if="!isMobile"
      data-qa-resize
      class="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize text-muted-foreground/60 hover:text-muted-foreground"
      title="拖动调整大小"
      @pointerdown.stop="onResizeDown"
      @pointermove="onResizeMove"
      @pointerup="onResizeUp"
    >
      <svg viewBox="0 0 10 10" class="h-full w-full" aria-hidden="true">
        <path d="M9 1 L1 9 M9 5 L5 9" stroke="currentColor" stroke-width="1" fill="none" />
      </svg>
    </div>
  </Card>
</template>
