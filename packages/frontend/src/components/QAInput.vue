<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQAStore } from '@/stores/qa'
import { api } from '@/api/client'
import { Send } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ paperId: number; sticky?: boolean }>(), { sticky: true })
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
  if (!question.value.trim() || !store.selectedModels.length) return
  await store.submitFreeQuestion(props.paperId, question.value.trim(), store.selectedModels)
  question.value = ''
}
</script>

<template>
  <div :class="[props.sticky ? 'sticky bottom-0' : '', 'z-10 pt-3 pb-3 px-3']"
    :style="{ background: props.sticky ? undefined : 'linear-gradient(to top, rgba(255,255,255,0.95) 60%, rgba(255,255,255,0))' }">
    <div class="rounded-2xl border border-gray-200 bg-white/95 backdrop-blur-sm shadow-lg p-3">
      <!-- Model chips -->
      <div class="flex items-center gap-1.5 flex-wrap mb-2">
        <span class="text-[10px] text-gray-400 uppercase tracking-wider mr-0.5">模型</span>
        <button v-for="m in availableModels" :key="m.name"
          @click="store.selectedModels.includes(m.name) ? store.selectedModels = store.selectedModels.filter(x => x !== m.name) : store.selectedModels.push(m.name)"
          :class="['rounded-full px-2 py-0.5 text-[11px] font-medium border transition-all',
            store.selectedModels.includes(m.name) ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300']">
          {{ m.name }}
        </button>
      </div>
      <!-- Input + submit -->
      <div class="flex gap-2 items-end">
        <textarea v-model="question" @keydown.ctrl.enter="submit" placeholder="输入问题..." rows="2"
          class="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition max-h-32 bg-white" />
        <button @click="submit" :disabled="!question.trim() || !store.selectedModels.length || store.submitting"
          class="rounded-xl bg-indigo-600 px-3.5 py-2.5 text-white hover:bg-indigo-700 disabled:opacity-40 transition shrink-0">
          <Send class="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
</template>
