<script setup lang="ts">
import { computed } from 'vue'
import { useQAStore } from '@/stores/qa'
import { Play, RefreshCw, CheckCircle2, Circle } from 'lucide-vue-next'

const props = defineProps<{ paperId: number }>()
const store = useQAStore()

const hasUngenerated = computed(() => store.templates.some(t => { const e = store.qaData.template[t.name]; return !e || e.results.length === 0 }))
function getLatest(name: string) { const e = store.qaData.template[name]; return e?.results?.[0] || null }
function isDone(name: string) { return !!getLatest(name) }

let pollTimer: ReturnType<typeof setInterval> | null = null
async function generateAll() { await store.triggerAllTemplates(props.paperId); startPolling() }
async function regenerate(name: string) { await store.regenerateTemplate(props.paperId, name); startPolling() }
function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    await store.fetchQA(props.paperId)
    if (store.templates.every(t => isDone(t.name)) && pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }, 3000)
}
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-white">
    <div class="flex items-center justify-between border-b border-gray-100 px-5 py-3">
      <h3 class="text-sm font-semibold text-gray-900">模板提问</h3>
      <button v-if="hasUngenerated" @click="generateAll" :disabled="store.submitting"
        class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition">
        <Play class="h-3 w-3" /> 一键生成
      </button>
    </div>
    <div v-if="!store.templates.length" class="px-5 py-8 text-center text-sm text-gray-400">暂无模板</div>
    <div v-else class="divide-y divide-gray-50">
      <details v-for="tmpl in store.templates" :key="tmpl.name" class="group">
        <summary class="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50/60 transition-colors list-none [&::-webkit-details-marker]:hidden">
          <CheckCircle2 v-if="isDone(tmpl.name)" class="h-4 w-4 text-emerald-500 shrink-0" />
          <Circle v-else class="h-4 w-4 text-gray-300 shrink-0" />
          <span class="text-sm font-medium text-gray-700 capitalize flex-1">{{ tmpl.name }}</span>
          <span v-if="getLatest(tmpl.name)" class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">{{ getLatest(tmpl.name)!.model_name }}</span>
        </summary>
        <div class="px-5 pb-4 pt-1">
          <div v-if="getLatest(tmpl.name)">
            <p class="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{{ getLatest(tmpl.name)!.answer }}</p>
            <div class="flex items-center justify-between mt-3">
              <span class="text-[10px] text-gray-400">{{ new Date(getLatest(tmpl.name)!.completed_at).toLocaleString() }}</span>
              <button @click="regenerate(tmpl.name)" class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 transition">
                <RefreshCw class="h-3 w-3" /> 重新生成
              </button>
            </div>
          </div>
          <div v-else class="text-sm text-gray-400 text-center py-3">
            <button @click="regenerate(tmpl.name)" class="text-indigo-600 hover:text-indigo-700 font-medium">生成</button>
          </div>
        </div>
      </details>
    </div>
  </div>
</template>
