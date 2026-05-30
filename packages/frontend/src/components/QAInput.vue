<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useQAStore } from '@/stores/qa'
import { useAuthStore } from '@/stores/auth'
import { useLoginPrompt } from '@/composables/useLoginPrompt'
import { useQAWindow } from '@/composables/useQAWindow'
import { api } from '@/api/client'
import { Send, LogIn, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'

const props = defineProps<{ paperId: number }>()
const store = useQAStore()
const auth = useAuthStore()
const { openLogin } = useLoginPrompt()
const { isOpen, left, top, width, height, close, setGeometry } = useQAWindow()
const isMobile = useMediaQuery('(max-width: 768px)')
const question = ref('')
const availableModels = ref<Array<{ name: string }>>([])

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
  if (!question.value.trim() || !store.selectedModels.length) return
  await store.submitFreeQuestion(props.paperId, question.value.trim(), store.selectedModels)
  question.value = ''
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
          :disabled="!question.trim() || !store.selectedModels.length || store.submitting"
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
      <Textarea
        v-model="question"
        @keydown.ctrl.enter="submit"
        placeholder="输入问题..."
        rows="2"
        class="flex-1 min-h-0 w-full resize-none"
      />
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
