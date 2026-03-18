<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQAStore } from '@/stores/qa'
import { api } from '@/api/client'
import { Send, RefreshCw, User, Bot } from 'lucide-vue-next'

const props = defineProps<{ paperId: number }>()
const store = useQAStore()
const question = ref('')
const availableModels = ref<Array<{ name: string }>>([])

onMounted(async () => {
  try {
    const res = await api.get<{ models: { available: Array<{ name: string }> } }>('/api/config/models')
    availableModels.value = res.models.available
    if (!store.selectedModels.length && availableModels.value.length) store.selectedModels = [availableModels.value[0].name]
  } catch {
    availableModels.value = [{ name: 'gpt-4o' }]
    if (!store.selectedModels.length) store.selectedModels = ['gpt-4o']
  }
})

async function submit() {
  if (!question.value.trim()) return
  await store.submitFreeQuestion(props.paperId, question.value.trim(), store.selectedModels)
  question.value = ''
  setTimeout(() => store.fetchQA(props.paperId), 2000)
  setTimeout(() => store.fetchQA(props.paperId), 5000)
  setTimeout(() => store.fetchQA(props.paperId), 10000)
}

function getLatest(entry: any) { return entry.results?.[0] || null }
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-white">
    <div class="border-b border-gray-100 px-5 py-3">
      <h3 class="text-sm font-semibold text-gray-900">自由提问</h3>
    </div>
    <div class="p-5 space-y-4">
      <!-- History -->
      <div v-for="entry in store.qaData.free" :key="entry.entry_id" class="space-y-2">
        <template v-if="getLatest(entry)">
          <div class="flex items-start gap-2.5">
            <div class="mt-0.5 rounded-full bg-gray-100 p-1.5"><User class="h-3 w-3 text-gray-500" /></div>
            <p class="text-sm text-gray-700 pt-1">{{ getLatest(entry).prompt }}</p>
          </div>
          <div class="flex items-start gap-2.5 ml-1">
            <div class="mt-0.5 rounded-full bg-indigo-50 p-1.5"><Bot class="h-3 w-3 text-indigo-600" /></div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{{ getLatest(entry).answer }}</p>
              <div class="flex items-center gap-2 mt-2">
                <span class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">{{ getLatest(entry).model_name }}</span>
                <span class="text-[10px] text-gray-400">{{ new Date(getLatest(entry).completed_at).toLocaleString() }}</span>
                <button @click="store.regenerateEntry(entry.entry_id, store.selectedModels)" class="ml-auto text-gray-400 hover:text-gray-600 transition">
                  <RefreshCw class="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="flex items-center gap-2 text-sm text-gray-400 py-2">
          <div class="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500"></div>
          正在生成回答...
        </div>
      </div>

      <div v-if="store.qaData.free.length" class="border-t border-gray-100"></div>

      <!-- Model chips -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-[10px] text-gray-400 uppercase tracking-wider mr-1">模型</span>
        <button v-for="m in availableModels" :key="m.name" @click="store.selectedModels.includes(m.name) ? store.selectedModels = store.selectedModels.filter(x => x !== m.name) : store.selectedModels.push(m.name)"
          :class="['rounded-full px-2.5 py-0.5 text-xs font-medium border transition-all', store.selectedModels.includes(m.name) ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300']">
          {{ m.name }}
        </button>
      </div>

      <!-- Input -->
      <div class="flex gap-2">
        <textarea v-model="question" @keydown.ctrl.enter="submit" placeholder="输入问题..." rows="1"
          class="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition" />
        <button @click="submit" :disabled="!question.trim() || !store.selectedModels.length || store.submitting"
          class="rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700 disabled:opacity-40 transition shrink-0">
          <Send class="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
</template>
