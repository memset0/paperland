<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useQAStore } from '@/stores/qa'
import { api } from '@/api/client'
import {
  Play, RefreshCw, CheckCircle2, Circle, Loader2, AlertCircle,
  ChevronsDownUp, ChevronsUpDown
} from 'lucide-vue-next'
import QAResultView from './QAResultView.vue'

const props = defineProps<{ paperId: number }>()
const store = useQAStore()
const availableModels = ref<Array<{ name: string }>>([])

onMounted(async () => {
  try {
    const res = await api.get<{ models: { available: Array<{ name: string }> } }>('/api/config/models')
    availableModels.value = res.models.available
  } catch {
    availableModels.value = [{ name: 'gpt-4o' }]
  }
})

// --- Unified entry type for rendering ---
interface UnifiedEntry {
  key: string           // 'free-{id}' or 'tmpl-{name}'
  type: 'free' | 'template'
  title: string         // question text
  entryId: number       // qa_entries.id (0 if not yet created)
  status: string        // pending/running/done/failed or 'idle'
  error: string | null
  results: any[]
  templateName?: string // only for template type
}

const unifiedEntries = computed(() => {
  const entries: UnifiedEntry[] = []

  // Free QA entries (newest first)
  for (const entry of store.qaData.free) {
    entries.push({
      key: 'free-' + entry.entry_id,
      type: 'free',
      title: entry.prompt || '自由提问',
      entryId: entry.entry_id,
      status: entry.status,
      error: entry.error,
      results: entry.results,
    })
  }

  // Template QA entries (config order)
  for (const tmpl of store.templates) {
    const data = store.qaData.template[tmpl.name]
    entries.push({
      key: 'tmpl-' + tmpl.name,
      type: 'template',
      title: tmpl.prompt,
      entryId: data?.entry_id || 0,
      status: data?.status || 'idle',
      error: data?.error || null,
      results: data?.results || [],
      templateName: tmpl.name,
    })
  }

  return entries
})

const hasResults = (e: UnifiedEntry) => e.results.length > 0
const isRunning = (e: UnifiedEntry) => e.status === 'running' || e.status === 'pending'
const isFailed = (e: UnifiedEntry) => e.status === 'failed'

// --- Collapse persistence ---
function collapseKey(entryKey: string) { return `qa-collapse-${props.paperId}-${entryKey}` }
function isOpen(entryKey: string, defaultOpen: boolean): boolean {
  const stored = localStorage.getItem(collapseKey(entryKey))
  if (stored !== null) return stored === '1'
  return defaultOpen
}
function toggleOpen(entryKey: string, el: HTMLDetailsElement) {
  localStorage.setItem(collapseKey(entryKey), el.open ? '1' : '0')
}
function setAllOpen(open: boolean) {
  const container = document.querySelector('[data-qa-list]')
  if (!container) return
  container.querySelectorAll<HTMLDetailsElement>('details[data-qa-entry]').forEach(el => {
    el.open = open
    const key = el.getAttribute('data-qa-entry')
    if (key) localStorage.setItem(collapseKey(key), open ? '1' : '0')
  })
}

// --- Template: has ungenerated ---
const hasUngenerated = computed(() =>
  store.templates.some(t => {
    const e = store.qaData.template[t.name]
    return !e || e.results.length === 0
  })
)

// --- Model selection dialog for regenerate ---
const regenDialog = ref<{
  show: boolean
  entry: UnifiedEntry | null
  selectedModels: string[]
}>({ show: false, entry: null, selectedModels: [] })

function openRegenDialog(entry: UnifiedEntry) {
  regenDialog.value = {
    show: true,
    entry,
    selectedModels: availableModels.value.length ? [availableModels.value[0].name] : [],
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

// --- Confirm dialog for running conflict ---
const confirmDialog = ref<{ show: boolean; message: string; onConfirm: () => void }>({
  show: false, message: '', onConfirm: () => {},
})

function submitRegen() {
  const { entry, selectedModels } = regenDialog.value
  if (!entry || !selectedModels.length) return

  // Check if any selected model is already running for this entry
  if (isRunning(entry)) {
    const runningModels = selectedModels.join(', ')
    confirmDialog.value = {
      show: true,
      message: `关于「${entry.title.slice(0, 30)}${entry.title.length > 30 ? '...' : ''}」正在生成中，是否需要重新提交 ${runningModels}？`,
      onConfirm: () => {
        doRegen(entry, selectedModels)
        confirmDialog.value.show = false
      },
    }
    regenDialog.value.show = false
    return
  }

  doRegen(entry, selectedModels)
  regenDialog.value.show = false
}

function doRegen(entry: UnifiedEntry, models: string[]) {
  if (entry.type === 'template' && entry.templateName) {
    // For templates, regenerate each model separately
    for (const model of models) {
      store.regenerateTemplate(props.paperId, entry.templateName, model)
    }
  } else {
    store.regenerateEntry(entry.entryId, props.paperId, models)
  }
}

// Called from QAResultView when user clicks regenerate on a specific model's result
function onResultRegenerate(entry: UnifiedEntry, modelName: string) {
  // Pre-select that model in the dialog
  regenDialog.value = {
    show: true,
    entry,
    selectedModels: [modelName],
  }
}

function onDeleteResult(resultId: number) {
  store.deleteResult(resultId, props.paperId)
}

// Direct generate for idle templates
function generateTemplate(templateName: string) {
  store.regenerateTemplate(props.paperId, templateName)
}
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-white">
    <div class="flex items-center justify-between border-b border-gray-100 px-5 py-3">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-semibold text-gray-900">Q&A</h3>
        <span v-if="store.polling" class="inline-flex items-center gap-1 text-[10px] text-indigo-500">
          <Loader2 class="h-3 w-3 animate-spin" /> 生成中...
        </span>
      </div>
      <div class="flex items-center gap-1.5">
        <button @click="setAllOpen(true)" title="全部展开"
          class="rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
          <ChevronsUpDown class="h-3.5 w-3.5" />
        </button>
        <button @click="setAllOpen(false)" title="全部折叠"
          class="rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
          <ChevronsDownUp class="h-3.5 w-3.5" />
        </button>
        <button v-if="hasUngenerated" @click="store.triggerAllTemplates(props.paperId)" :disabled="store.submitting"
          class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition">
          <Play class="h-3 w-3" /> 一键生成
        </button>
      </div>
    </div>

    <div class="divide-y divide-gray-50" data-qa-list>
      <template v-for="entry in unifiedEntries" :key="entry.key">

        <!-- HAS RESULTS: collapsible details -->
        <details v-if="hasResults(entry)"
          class="group"
          :data-qa-entry="entry.key"
          :open="isOpen(entry.key, true)"
          @toggle="(e: Event) => toggleOpen(entry.key, e.target as HTMLDetailsElement)">
          <summary class="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50/60 transition-colors list-none [&::-webkit-details-marker]:hidden">
            <CheckCircle2 v-if="entry.status === 'done'" class="h-4 w-4 text-emerald-500 shrink-0" />
            <Loader2 v-else-if="isRunning(entry)" class="h-4 w-4 text-indigo-500 shrink-0 animate-spin" />
            <CheckCircle2 v-else class="h-4 w-4 text-emerald-500 shrink-0" />
            <div class="flex-1 min-w-0">
              <span class="text-sm font-semibold text-gray-800 line-clamp-1">{{ entry.title }}</span>
            </div>
            <span v-if="entry.results.length > 1" class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 shrink-0">
              {{ entry.results.length }} 个回答
            </span>
            <span v-else class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 shrink-0">
              {{ entry.results[0].model_name }}
            </span>
          </summary>
          <div class="px-5 pb-4 pt-1">
            <QAResultView
              :results="entry.results"
              :entry-key="entry.key"
              :paper-id="props.paperId"
              @regenerate="(model: string) => onResultRegenerate(entry, model)"
              @delete-result="onDeleteResult"
            />
          </div>
        </details>

        <!-- NO RESULTS: inline row -->
        <div v-else class="flex items-center gap-3 px-5 py-3">
          <AlertCircle v-if="isFailed(entry)" class="h-4 w-4 text-red-500 shrink-0" />
          <Loader2 v-else-if="isRunning(entry)" class="h-4 w-4 text-indigo-500 shrink-0 animate-spin" />
          <Circle v-else class="h-4 w-4 text-gray-300 shrink-0" />
          <div class="flex-1 min-w-0">
            <span class="text-sm font-semibold text-gray-800 line-clamp-1">{{ entry.title }}</span>
            <p v-if="isFailed(entry) && entry.error" class="text-xs text-red-500 mt-0.5 truncate">{{ entry.error }}</p>
          </div>
          <!-- Running -->
          <span v-if="isRunning(entry)" class="text-[10px] text-indigo-500 shrink-0">生成中...</span>
          <!-- Failed: retry -->
          <button v-else-if="isFailed(entry)" @click.stop="entry.type === 'template' ? generateTemplate(entry.templateName!) : store.regenerateEntry(entry.entryId, props.paperId, store.selectedModels)"
            class="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition">
            重试
          </button>
          <!-- Idle: generate -->
          <button v-else @click.stop="entry.type === 'template' ? generateTemplate(entry.templateName!) : openRegenDialog(entry)"
            class="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition">
            生成
          </button>
        </div>

      </template>

      <!-- Empty -->
      <div v-if="!unifiedEntries.length" class="px-5 py-8 text-center text-sm text-gray-400">暂无 Q&A 记录</div>
    </div>
  </div>

  <!-- Model selection dialog for regenerate -->
  <Teleport to="body">
    <div v-if="regenDialog.show" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" @click="regenDialog.show = false"></div>
      <div class="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <h4 class="text-sm font-semibold text-gray-900 mb-1">重新生成</h4>
        <p class="text-xs text-gray-500 mb-4 truncate">{{ regenDialog.entry?.title }}</p>
        <!-- Model selection -->
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

  <!-- Confirm dialog for running conflict -->
  <Teleport to="body">
    <div v-if="confirmDialog.show" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" @click="confirmDialog.show = false"></div>
      <div class="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <p class="text-sm text-gray-700 mb-4">{{ confirmDialog.message }}</p>
        <div class="flex justify-end gap-2">
          <button @click="confirmDialog.show = false" class="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 transition">取消</button>
          <button @click="confirmDialog.onConfirm()" class="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition">重新提交</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
