<script setup lang="ts">
import { computed } from 'vue'
import { useQAStore } from '@/stores/qa'
import { Play, RefreshCw, CheckCircle2, Circle, Loader2, AlertCircle, Copy, Check } from 'lucide-vue-next'
import MarkdownContent from './MarkdownContent.vue'
import { ref } from 'vue'

const props = defineProps<{ paperId: number }>()
const store = useQAStore()
const copiedName = ref<string | null>(null)

const hasUngenerated = computed(() =>
  store.templates.some(t => {
    const e = store.qaData.template[t.name]
    return !e || (e.results.length === 0 && e.status !== 'running' && e.status !== 'pending')
  })
)

function getEntry(name: string) { return store.qaData.template[name] || null }
function getLatest(name: string) { return getEntry(name)?.results?.[0] || null }
function getStatus(name: string): string { return getEntry(name)?.status || 'none' }
function getError(name: string): string | null { return getEntry(name)?.error || null }

async function generateAll() { await store.triggerAllTemplates(props.paperId) }
async function regenerate(name: string) { await store.regenerateTemplate(props.paperId, name) }

function copyAnswer(name: string) {
  const latest = getLatest(name)
  if (!latest) return
  navigator.clipboard.writeText(latest.answer)
  copiedName.value = name
  setTimeout(() => { copiedName.value = null }, 2000)
}
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-white">
    <div class="flex items-center justify-between border-b border-gray-100 px-5 py-3">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-semibold text-gray-900">模板提问</h3>
        <span v-if="store.polling" class="inline-flex items-center gap-1 text-[10px] text-indigo-500">
          <Loader2 class="h-3 w-3 animate-spin" /> 生成中...
        </span>
      </div>
      <button v-if="hasUngenerated" @click="generateAll" :disabled="store.submitting"
        class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition">
        <Play class="h-3 w-3" /> 一键生成
      </button>
    </div>
    <div v-if="!store.templates.length" class="px-5 py-8 text-center text-sm text-gray-400">暂无模板</div>
    <div v-else class="divide-y divide-gray-50">
      <details v-for="tmpl in store.templates" :key="tmpl.name" class="group" :open="!!getLatest(tmpl.name)">
        <summary class="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50/60 transition-colors list-none [&::-webkit-details-marker]:hidden">
          <!-- Status icon -->
          <CheckCircle2 v-if="getStatus(tmpl.name) === 'done'" class="h-4 w-4 text-emerald-500 shrink-0" />
          <AlertCircle v-else-if="getStatus(tmpl.name) === 'failed'" class="h-4 w-4 text-red-500 shrink-0" />
          <Loader2 v-else-if="getStatus(tmpl.name) === 'running' || getStatus(tmpl.name) === 'pending'" class="h-4 w-4 text-indigo-500 shrink-0 animate-spin" />
          <Circle v-else class="h-4 w-4 text-gray-300 shrink-0" />

          <div class="flex-1 min-w-0">
            <span class="text-sm font-medium text-gray-700">{{ tmpl.name }}</span>
            <span class="block text-xs text-gray-400 truncate">{{ tmpl.prompt }}</span>
          </div>
          <span v-if="getLatest(tmpl.name)" class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 shrink-0">
            {{ getLatest(tmpl.name)!.model_name }}
          </span>
        </summary>
        <div class="px-5 pb-4 pt-1">
          <!-- Error state -->
          <div v-if="getStatus(tmpl.name) === 'failed'" class="rounded-lg bg-red-50 border border-red-100 p-3 mb-3">
            <div class="flex items-start gap-2">
              <AlertCircle class="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div class="flex-1 min-w-0">
                <p class="text-xs font-medium text-red-700">生成失败</p>
                <p class="text-xs text-red-600 mt-0.5 break-all">{{ getError(tmpl.name) }}</p>
              </div>
            </div>
            <button @click="regenerate(tmpl.name)" class="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-100 transition">
              <RefreshCw class="h-3 w-3" /> 重试
            </button>
          </div>

          <!-- Running state -->
          <div v-if="getStatus(tmpl.name) === 'running' || getStatus(tmpl.name) === 'pending'" class="flex items-center gap-2 text-sm text-gray-400 py-3">
            <Loader2 class="h-4 w-4 animate-spin text-indigo-500" />
            正在生成回答...
          </div>

          <!-- Result -->
          <div v-if="getLatest(tmpl.name)">
            <MarkdownContent :content="getLatest(tmpl.name)!.answer" class="text-sm text-gray-600" />
            <div class="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
              <span class="text-[10px] text-gray-400">{{ new Date(getLatest(tmpl.name)!.completed_at).toLocaleString() }}</span>
              <div class="flex items-center gap-1">
                <button @click="copyAnswer(tmpl.name)" class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 transition">
                  <Check v-if="copiedName === tmpl.name" class="h-3 w-3 text-emerald-500" />
                  <Copy v-else class="h-3 w-3" />
                  {{ copiedName === tmpl.name ? '已复制' : '复制' }}
                </button>
                <button @click="regenerate(tmpl.name)" class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 transition">
                  <RefreshCw class="h-3 w-3" /> 重新生成
                </button>
              </div>
            </div>
          </div>

          <!-- No result, not running, not failed -->
          <div v-if="!getLatest(tmpl.name) && getStatus(tmpl.name) !== 'running' && getStatus(tmpl.name) !== 'pending' && getStatus(tmpl.name) !== 'failed'" class="text-sm text-gray-400 text-center py-3">
            <button @click="regenerate(tmpl.name)" class="text-indigo-600 hover:text-indigo-700 font-medium">生成</button>
          </div>
        </div>
      </details>
    </div>
  </div>
</template>
