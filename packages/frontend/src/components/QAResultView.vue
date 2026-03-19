<script setup lang="ts">
import { ref } from 'vue'
import { type QAResult } from '@/stores/qa'
import { RefreshCw, Copy, Check, Trash2, Pin } from 'lucide-vue-next'
import MarkdownContent from './MarkdownContent.vue'

const props = defineProps<{
  results: QAResult[]
  entryKey: string
  paperId: number
  highlightPathname?: string
}>()

const emit = defineEmits<{
  regenerate: [modelName: string]
  deleteResult: [resultId: number]
}>()

const copiedId = ref<number | null>(null)

// --- Time formatting ---
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

// --- Pin persistence ---
function pinKey(entryKey: string) { return `qa-pin-${props.paperId}-${entryKey}` }
function getPinnedModel(): string | null { return localStorage.getItem(pinKey(props.entryKey)) }
function pinResult(modelName: string) {
  const current = getPinnedModel()
  if (current === modelName) {
    localStorage.removeItem(pinKey(props.entryKey))
  } else {
    localStorage.setItem(pinKey(props.entryKey), modelName)
  }
}

// --- Sort results: pinned first, then by completed_at ascending ---
function sortedResults(): QAResult[] {
  const pinned = getPinnedModel()
  return [...props.results].sort((a, b) => {
    if (pinned) {
      if (a.model_name === pinned && b.model_name !== pinned) return -1
      if (b.model_name === pinned && a.model_name !== pinned) return 1
    }
    return new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
  })
}

// --- Tab state ---
const activeTabIdx = ref(0)

function copyAnswer(resultId: number, text: string) {
  navigator.clipboard.writeText(text)
  copiedId.value = resultId
  setTimeout(() => { copiedId.value = null }, 2000)
}
</script>

<template>
  <!-- Multi-model tabs -->
  <div v-if="results.length > 1">
    <div class="flex gap-1 mb-3 overflow-x-auto pb-1">
      <button v-for="(r, idx) in sortedResults()" :key="r.id"
        @click="activeTabIdx = idx"
        :class="['flex flex-col items-start rounded-lg px-3 py-1.5 text-xs border transition-all shrink-0',
          activeTabIdx === idx
            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300']">
        <span class="font-medium">{{ r.model_name }}</span>
        <span class="text-[10px] opacity-70">{{ timeAgo(r.completed_at) }}</span>
      </button>
    </div>
    <template v-for="(r, idx) in sortedResults()" :key="r.id">
      <div v-if="activeTabIdx === idx">
        <MarkdownContent :content="r.answer" :highlight-pathname="highlightPathname" class="text-sm text-gray-600" />
        <div class="flex items-center gap-1 mt-3 pt-2 border-t border-gray-50">
          <button @click="pinResult(r.model_name)" :title="getPinnedModel() === r.model_name ? '取消置顶' : '置顶'"
            :class="['rounded-md px-1.5 py-1 text-xs transition', getPinnedModel() === r.model_name ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:text-gray-600']">
            <Pin class="h-3 w-3" />
          </button>
          <button @click="copyAnswer(r.id, r.answer)" class="rounded-md px-1.5 py-1 text-xs text-gray-400 hover:text-gray-600 transition">
            <Check v-if="copiedId === r.id" class="h-3 w-3 text-emerald-500" /><Copy v-else class="h-3 w-3" />
          </button>
          <button @click="emit('regenerate', r.model_name)" class="rounded-md px-1.5 py-1 text-xs text-gray-400 hover:text-gray-600 transition">
            <RefreshCw class="h-3 w-3" />
          </button>
          <button @click="emit('deleteResult', r.id)" class="rounded-md px-1.5 py-1 text-xs text-gray-400 hover:text-red-500 transition">
            <Trash2 class="h-3 w-3" />
          </button>
        </div>
      </div>
    </template>
  </div>

  <!-- Single result -->
  <div v-else-if="results.length === 1">
    <MarkdownContent :content="results[0].answer" :highlight-pathname="highlightPathname" class="text-sm text-gray-600" />
    <div class="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
      <div class="flex items-center gap-2">
        <span class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">{{ results[0].model_name }}</span>
        <span class="text-[10px] text-gray-400">{{ timeAgo(results[0].completed_at) }}</span>
      </div>
      <div class="flex items-center gap-1">
        <button @click="copyAnswer(results[0].id, results[0].answer)" class="rounded-md px-1.5 py-1 text-xs text-gray-400 hover:text-gray-600 transition">
          <Check v-if="copiedId === results[0].id" class="h-3 w-3 text-emerald-500" /><Copy v-else class="h-3 w-3" />
        </button>
        <button @click="emit('regenerate', results[0].model_name)" class="rounded-md px-1.5 py-1 text-xs text-gray-400 hover:text-gray-600 transition">
          <RefreshCw class="h-3 w-3" />
        </button>
        <button @click="emit('deleteResult', results[0].id)" class="rounded-md px-1.5 py-1 text-xs text-gray-400 hover:text-red-500 transition">
          <Trash2 class="h-3 w-3" />
        </button>
      </div>
    </div>
  </div>
</template>
