<script setup lang="ts">
import { computed } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useWindowsStore, type NoteWindow } from '@/stores/windows'
import NoteEditor from './NoteEditor.vue'
import { X } from '@lucide/vue'

const props = defineProps<{ win: NoteWindow }>()
const store = useWindowsStore()
const isMobile = useMediaQuery('(max-width: 768px)')

const style = computed(() =>
  isMobile.value
    ? { zIndex: 200 }
    : {
        left: props.win.x + 'px',
        top: props.win.y + 'px',
        width: props.win.w + 'px',
        height: props.win.h + 'px',
        zIndex: props.win.z,
      },
)

// --- Drag (desktop only, via the title bar) ---
let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0
function onHeaderDown(e: PointerEvent) {
  if (isMobile.value) return
  store.focus(props.win.key)
  dragging = true
  sx = e.clientX; sy = e.clientY; ox = props.win.x; oy = props.win.y
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onHeaderMove(e: PointerEvent) {
  if (!dragging) return
  store.setGeometry(props.win.key, { x: ox + (e.clientX - sx), y: Math.max(0, oy + (e.clientY - sy)) })
}
function onHeaderUp(e: PointerEvent) {
  dragging = false
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
}

// --- Resize (desktop only, bottom-right handle) ---
let resizing = false, rx = 0, ry = 0, rw = 0, rh = 0
function onResizeDown(e: PointerEvent) {
  e.stopPropagation()
  store.focus(props.win.key)
  resizing = true
  rx = e.clientX; ry = e.clientY; rw = props.win.w; rh = props.win.h
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onResizeMove(e: PointerEvent) {
  if (!resizing) return
  store.setGeometry(props.win.key, {
    w: Math.max(280, rw + (e.clientX - rx)),
    h: Math.max(200, rh + (e.clientY - ry)),
  })
}
function onResizeUp(e: PointerEvent) {
  resizing = false
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
}
</script>

<template>
  <div
    class="fixed bg-popover text-popover-foreground border shadow-2xl rounded-lg flex flex-col overflow-hidden"
    :class="isMobile ? 'inset-0 rounded-none' : ''"
    :style="style"
    @pointerdown="store.focus(win.key)"
  >
    <div
      class="flex items-center gap-2 px-3 py-2 border-b bg-muted/40 select-none shrink-0"
      :class="isMobile ? '' : 'cursor-move'"
      @pointerdown="onHeaderDown"
      @pointermove="onHeaderMove"
      @pointerup="onHeaderUp"
    >
      <span class="text-xs font-semibold truncate flex-1">{{ win.title }}</span>
      <button
        class="p-1 rounded hover:bg-accent shrink-0"
        title="Close"
        @pointerdown.stop
        @click="store.close(win.key)"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </div>

    <div class="flex-1 min-h-0 overflow-hidden">
      <NoteEditor :win="win" />
    </div>

    <div
      v-if="!isMobile"
      class="absolute bottom-0 right-0 h-3.5 w-3.5 cursor-se-resize"
      @pointerdown="onResizeDown"
      @pointermove="onResizeMove"
      @pointerup="onResizeUp"
    >
      <svg viewBox="0 0 10 10" class="h-full w-full text-muted-foreground/60">
        <path d="M9 1 L1 9 M9 5 L5 9" stroke="currentColor" stroke-width="1" fill="none" />
      </svg>
    </div>
  </div>
</template>
