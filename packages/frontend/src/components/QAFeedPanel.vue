<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useQAStore } from '@/stores/qa'
import { useHighlightStore } from '@/stores/highlights'
import { api } from '@/api/client'
import type { QAFeedEntry } from '@paperland/shared'
import {
  CheckCircle2, Loader2, AlertCircle, ChevronRight,
  RefreshCw, ExternalLink
} from 'lucide-vue-next'
import QAResultView from './QAResultView.vue'

const props = defineProps<{ entry: QAFeedEntry }>()
const emit = defineEmits<{ refresh: [] }>()

const store = useQAStore()
const highlightStore = useHighlightStore()
const isOpen = ref(false)
const availableModels = ref<Array<{ name: string }>>([])

onMounted(async () => {
  try {
    const res = await api.get<{ models: { available: Array<{ name: string }> } }>('/api/config/models')
    availableModels.value = res.models.available
  } catch {
    availableModels.value = [{ name: 'gpt-4o' }]
  }
})

function toggle() {
  isOpen.value = !isOpen.value
  // Load highlights for the paper's pathname when opening
  if (isOpen.value) {
    highlightStore.loadForPathname(`/papers/${props.entry.paper_id}`)
  }
}

function timeAgo(iso: string): string {
  if (!iso) return ''
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

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

// --- Model selection dialog for regenerate ---
const regenDialog = ref<{
  show: boolean
  selectedModels: string[]
}>({ show: false, selectedModels: [] })

function openRegenDialog(preselect?: string) {
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
  <div class="rounded-xl border border-gray-200 bg-white overflow-hidden transition-shadow hover:shadow-sm">
    <!-- Header -->
    <button
      @click="toggle"
      class="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50/60 transition-colors"
    >
      <!-- Status icon -->
      <CheckCircle2 v-if="entry.status === 'done'" class="h-4 w-4 text-emerald-500 shrink-0" />
      <Loader2 v-else-if="entry.status === 'running' || entry.status === 'pending'" class="h-4 w-4 text-indigo-500 shrink-0 animate-spin" />
      <AlertCircle v-else-if="entry.status === 'failed'" class="h-4 w-4 text-red-500 shrink-0" />

      <!-- Expand chevron -->
      <ChevronRight
        :class="['h-4 w-4 text-gray-400 shrink-0 transition-transform duration-200', isOpen && 'rotate-90']"
      />

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-800 line-clamp-1">{{ entry.prompt || '自由提问' }}</p>
        <div class="flex items-center gap-2 mt-0.5">
          <router-link
            :to="`/papers/${entry.paper_id}`"
            class="text-[11px] text-indigo-500 hover:text-indigo-700 hover:underline truncate max-w-[200px]"
            @click.stop
          >
            <ExternalLink class="h-3 w-3 inline mr-0.5 -mt-0.5" />{{ entry.paper_title }}
          </router-link>
          <span class="text-[10px] text-gray-400">{{ formatDate(entry.created_at) }}</span>
        </div>
      </div>

      <!-- Right side info -->
      <div class="flex items-center gap-2 shrink-0">
        <span v-if="entry.results.length > 1" class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
          {{ entry.results.length }} 个回答
        </span>
        <span v-else-if="entry.results.length === 1" class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
          {{ entry.results[0].model_name }}
        </span>
        <span v-if="entry.status === 'running' || entry.status === 'pending'" class="text-[10px] text-indigo-500">
          生成中...
        </span>
      </div>
    </button>

    <!-- Expanded body -->
    <div v-if="isOpen" class="border-t border-gray-100 px-5 py-4">
      <!-- Has results -->
      <div v-if="entry.results.length > 0">
        <QAResultView
          :results="entry.results"
          :entry-key="`feed-${entry.entry_id}`"
          :paper-id="entry.paper_id"
          :highlight-pathname="`/papers/${entry.paper_id}`"
          @regenerate="(model: string) => openRegenDialog(model)"
          @delete-result="onDeleteResult"
        />
      </div>

      <!-- No results yet -->
      <div v-else-if="entry.status === 'running' || entry.status === 'pending'" class="py-4 text-center">
        <Loader2 class="h-5 w-5 mx-auto mb-2 animate-spin text-indigo-400" />
        <p class="text-xs text-gray-400">正在生成回答...</p>
      </div>

      <!-- Failed -->
      <div v-else-if="entry.status === 'failed'" class="py-4 text-center">
        <p class="text-xs text-red-500 mb-2">{{ entry.error || '生成失败' }}</p>
        <button @click="openRegenDialog()" class="text-xs text-indigo-600 hover:underline">
          <RefreshCw class="h-3 w-3 inline mr-1" />重试
        </button>
      </div>

      <div v-else class="py-4 text-center text-xs text-gray-400">暂无回答</div>
    </div>
  </div>

  <!-- Model selection dialog for regenerate -->
  <Teleport to="body">
    <div v-if="regenDialog.show" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" @click="regenDialog.show = false"></div>
      <div class="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <h4 class="text-sm font-semibold text-gray-900 mb-1">重新生成</h4>
        <p class="text-xs text-gray-500 mb-4 truncate">{{ entry.prompt }}</p>
        <div class="flex flex-wrap gap-1.5 mb-5">
          <button v-for="m in availableModels" :key="m.name" @click="toggleRegenModel(m.name)"
            :class="['rounded-full px-3 py-1 text-xs font-medium border transition-all',
              regenDialog.selectedModels.includes(m.name)
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300']">
            {{ m.name }}
          </button>
        </div>
        <div class="flex justify-end gap-2">
          <button @click="regenDialog.show = false" class="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 transition">取消</button>
          <button @click="submitRegen" :disabled="!regenDialog.selectedModels.length"
            class="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40 transition">
            <RefreshCw class="h-3 w-3 inline mr-1" />提交
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
