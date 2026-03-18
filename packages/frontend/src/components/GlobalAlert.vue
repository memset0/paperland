<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { errorBus, API_ERROR_EVENT } from '@/lib/error-bus'
import { X } from 'lucide-vue-next'

interface Toast {
  id: number
  message: string
  timer: ReturnType<typeof setTimeout>
}

const MAX_TOASTS = 5
const AUTO_DISMISS_MS = 5000

let nextId = 0
const toasts = ref<Toast[]>([])

function addToast(message: string) {
  const id = nextId++
  const timer = setTimeout(() => removeToast(id), AUTO_DISMISS_MS)
  toasts.value.push({ id, message, timer })
  if (toasts.value.length > MAX_TOASTS) {
    const oldest = toasts.value[0]
    clearTimeout(oldest.timer)
    toasts.value.shift()
  }
}

function removeToast(id: number) {
  const idx = toasts.value.findIndex(t => t.id === id)
  if (idx !== -1) {
    clearTimeout(toasts.value[idx].timer)
    toasts.value.splice(idx, 1)
  }
}

function onApiError(e: Event) {
  addToast((e as CustomEvent).detail)
}

onMounted(() => errorBus.addEventListener(API_ERROR_EVENT, onApiError))
onUnmounted(() => {
  errorBus.removeEventListener(API_ERROR_EVENT, onApiError)
  toasts.value.forEach(t => clearTimeout(t.timer))
})
</script>

<template>
  <div class="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
    <TransitionGroup
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm text-white shadow-lg shadow-red-600/20 max-w-md"
      >
        <span class="flex-1">{{ toast.message }}</span>
        <button @click="removeToast(toast.id)" class="shrink-0 rounded p-0.5 hover:bg-red-500 transition-colors">
          <X class="h-3.5 w-3.5" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
