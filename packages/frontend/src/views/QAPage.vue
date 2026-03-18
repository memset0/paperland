<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import { usePapersStore } from '@/stores/papers'
import { useQAStore } from '@/stores/qa'
import { MessageSquare, Search } from 'lucide-vue-next'
import TemplateQA from '@/components/TemplateQA.vue'
import FreeQA from '@/components/FreeQA.vue'

const papersStore = usePapersStore()
const qaStore = useQAStore()
const selectedPaperId = ref<number | null>(null)
const paperSearch = ref('')

onMounted(async () => { await papersStore.fetchPapers(1, ''); await qaStore.fetchTemplates() })
onUnmounted(() => { qaStore.stopPolling() })

watch(selectedPaperId, async (id) => {
  qaStore.stopPolling()
  if (id) await qaStore.fetchQA(id)
})

const filteredPapers = () => papersStore.papers.filter(p => !paperSearch.value || p.title.toLowerCase().includes(paperSearch.value.toLowerCase()))
</script>

<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-gray-900">Q&A</h1>
      <p class="text-sm text-gray-500 mt-0.5">基于论文内容进行智能问答</p>
    </div>

    <!-- Paper selector -->
    <div class="rounded-xl border border-gray-200 bg-white p-4 mb-5">
      <div class="relative mb-2">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input v-model="paperSearch" placeholder="搜索论文..." class="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
      </div>
      <div class="max-h-48 overflow-y-auto space-y-0.5">
        <button v-for="p in filteredPapers()" :key="p.id" @click="selectedPaperId = p.id"
          :class="['w-full text-left rounded-lg px-3 py-2 text-sm transition-colors', selectedPaperId === p.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50']">
          {{ p.title }}
        </button>
        <div v-if="!filteredPapers().length" class="text-center py-4 text-sm text-gray-400">暂无论文</div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="qaStore.loading && selectedPaperId" class="rounded-xl border border-gray-200 bg-white py-12 text-center">
      <div class="h-6 w-6 mx-auto mb-3 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500"></div>
      <p class="text-sm text-gray-400">加载中...</p>
    </div>

    <div v-else-if="selectedPaperId" class="space-y-5">
      <TemplateQA :paper-id="selectedPaperId" />
      <FreeQA :paper-id="selectedPaperId" />
    </div>
    <div v-else class="rounded-xl border border-gray-200 bg-white py-16 text-center">
      <MessageSquare class="h-10 w-10 mx-auto mb-3 text-gray-300 stroke-1" />
      <p class="text-sm text-gray-400">请先选择一篇论文</p>
    </div>
  </div>
</template>
