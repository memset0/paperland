<script setup lang="ts">
import { computed } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { X } from '@lucide/vue'
import { useWindowsStore, type FloatingWindowState } from '@/stores/windows'

/**
 * The one floating-window shell of the app (note editors, Q&A tree, the question box). Geometry,
 * z-order and size memory live in `stores/windows.ts`. Desktop: fixed at the window's geometry,
 * resizable from a bottom-right grip, raised on pointer-down. Mobile: a fullscreen overlay.
 *
 * Two looks:
 * - default: popover chrome with a title bar (drag by the title bar, close button on the right);
 * - `bare`: no chrome at all — the slot content (e.g. the question box card) is the window, and it
 *   is moved by dragging any empty area (not inputs/buttons/links).
 */
const props = withDefaults(defineProps<{
  win: FloatingWindowState
  bare?: boolean
  minWidth?: number
  minHeight?: number
}>(), { bare: false, minWidth: 280, minHeight: 200 })

const store = useWindowsStore()
const isMobile = useMediaQuery('(max-width: 768px)')

const style = computed(() =>
  isMobile.value
    ? { zIndex: Math.max(200, props.win.z) }
    : { left: props.win.x + 'px', top: props.win.y + 'px', width: props.win.w + 'px', height: props.win.h + 'px', zIndex: props.win.z },
)

// --- Move: by the title bar, or (bare) by any empty area ---
let moving = false, sx = 0, sy = 0, ox = 0, oy = 0
function startMove(e: PointerEvent) {
  if (isMobile.value) return
  moving = true
  sx = e.clientX; sy = e.clientY; ox = props.win.x; oy = props.win.y
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onBodyDown(e: PointerEvent) {
  store.focus(props.win.key)
  if (!props.bare) return
  const t = e.target as HTMLElement
  if (t.closest('button, textarea, a, input, select, label, [data-window-resize], [data-window-nodrag]')) return
  startMove(e)
}
function onMove(e: PointerEvent) {
  if (!moving) return
  store.setGeometry(props.win.key, { x: ox + (e.clientX - sx), y: Math.max(0, oy + (e.clientY - sy)) })
}
function onUp(e: PointerEvent) {
  moving = false
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
}

// --- Resize: bottom-right grip ---
let resizing = false, rx = 0, ry = 0, rw = 0, rh = 0
function onResizeDown(e: PointerEvent) {
  store.focus(props.win.key)
  resizing = true
  rx = e.clientX; ry = e.clientY; rw = props.win.w; rh = props.win.h
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onResizeMove(e: PointerEvent) {
  if (!resizing) return
  store.setGeometry(props.win.key, {
    w: Math.max(props.minWidth, rw + (e.clientX - rx)),
    h: Math.max(props.minHeight, rh + (e.clientY - ry)),
  })
}
function onResizeUp(e: PointerEvent) {
  resizing = false
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
}
</script>

<template>
  <div
    class="fixed flex flex-col"
    :class="[
      bare ? '' : 'overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-2xl',
      isMobile ? 'inset-0 rounded-none' : (bare ? 'cursor-move' : ''),
    ]"
    :style="style"
    :data-floating-window="win.kind"
    @pointerdown="onBodyDown"
    @pointermove="onMove"
    @pointerup="onUp"
  >
    <div
      v-if="!bare"
      class="flex shrink-0 select-none items-center gap-2 border-b bg-muted/40 px-3 py-2"
      :class="isMobile ? '' : 'cursor-move'"
      @pointerdown="startMove"
      @pointermove="onMove"
      @pointerup="onUp"
    >
      <span class="flex-1 truncate text-xs font-semibold">{{ win.title }}</span>
      <slot name="actions" />
      <button
        class="shrink-0 rounded p-1 hover:bg-accent"
        title="Close"
        @pointerdown.stop
        @click="store.close(win.key)"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </div>

    <div class="min-h-0 flex-1" :class="bare ? 'flex flex-col' : 'overflow-hidden'">
      <slot />
    </div>

    <div
      v-if="!isMobile"
      data-window-resize
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
  </div>
</template>
