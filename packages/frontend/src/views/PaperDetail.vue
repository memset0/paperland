<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePapersStore } from '@/stores/papers'
import { useQAStore } from '@/stores/qa'
import { ArrowLeft, ExternalLink, Calendar, Users, Tag, FileText } from 'lucide-vue-next'
import PdfViewer from '@/components/PdfViewer.vue'
import TemplateQA from '@/components/TemplateQA.vue'
import FreeQA from '@/components/FreeQA.vue'

const route = useRoute()
const router = useRouter()
const store = usePapersStore()
const qaStore = useQAStore()
const paperId = computed(() => parseInt(route.params.id as string, 10))

// Draggable split
const leftWidth = ref(45) // percent
const dragging = ref(false)

function startDrag() { dragging.value = true }
function onDrag(e: MouseEvent) {
  if (!dragging.value) return
  const container = document.getElementById('split-container')
  if (!container) return
  const rect = container.getBoundingClientRect()
  const pct = ((e.clientX - rect.left) / rect.width) * 100
  leftWidth.value = Math.max(20, Math.min(80, pct))
}
function stopDrag() { dragging.value = false }

onMounted(async () => {
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  await store.fetchPaper(paperId.value)
  await qaStore.fetchTemplates()
  await qaStore.fetchQA(paperId.value)
})
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5 shrink-0">
      <button @click="router.push('/')" class="rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
        <ArrowLeft class="h-4 w-4" />
      </button>
      <div class="min-w-0 flex-1">
        <h1 class="text-sm font-semibold text-gray-900 truncate">{{ store.currentPaper?.title || '加载中...' }}</h1>
      </div>
    </div>

    <!-- Split view -->
    <div id="split-container" class="flex flex-1 overflow-hidden" :class="{ 'select-none': dragging }">
      <!-- Left: PDF -->
      <div :style="{ width: leftWidth + '%' }" class="shrink-0 overflow-hidden">
        <PdfViewer :pdf-path="store.currentPaper?.pdf_path || null" />
      </div>

      <!-- Divider -->
      <div @mousedown.prevent="startDrag" class="w-1 shrink-0 cursor-col-resize bg-gray-200 hover:bg-indigo-400 active:bg-indigo-500 transition-colors"></div>

      <!-- Right: Info + QA -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="store.loading" class="flex items-center justify-center h-full">
          <div class="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-600"></div>
        </div>

        <div v-else-if="store.currentPaper" class="p-5 space-y-5">
          <!-- Paper info card -->
          <div class="rounded-xl border border-gray-200 bg-white p-5">
            <h2 class="text-lg font-semibold text-gray-900 leading-snug mb-3">{{ store.currentPaper.title }}</h2>

            <div class="flex flex-wrap gap-1.5 mb-4">
              <span v-if="store.currentPaper.arxiv_id" class="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/10">
                <ExternalLink class="h-3 w-3" /> arXiv: {{ store.currentPaper.arxiv_id }}
              </span>
              <span v-if="store.currentPaper.corpus_id" class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                Corpus: {{ store.currentPaper.corpus_id }}
              </span>
              <span class="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-xs text-gray-500 ring-1 ring-inset ring-gray-200">
                <Calendar class="h-3 w-3" /> {{ new Date(store.currentPaper.created_at).toLocaleDateString() }}
              </span>
            </div>

            <!-- Authors -->
            <div v-if="store.currentPaper.authors?.length" class="mb-4">
              <div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                <Users class="h-3 w-3" /> 作者
              </div>
              <div class="flex flex-wrap gap-1">
                <span v-for="a in (Array.isArray(store.currentPaper.authors) ? store.currentPaper.authors : [])" :key="a"
                  class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">{{ a }}</span>
              </div>
            </div>

            <!-- Tags -->
            <div v-if="(store.currentPaper as any).tags?.length" class="mb-4">
              <div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                <Tag class="h-3 w-3" /> 标签
              </div>
              <div class="flex flex-wrap gap-1">
                <span v-for="t in (store.currentPaper as any).tags" :key="t"
                  class="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-600/10">{{ t }}</span>
              </div>
            </div>

            <!-- Abstract -->
            <div v-if="store.currentPaper.abstract">
              <div class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">摘要</div>
              <p class="text-sm text-gray-600 leading-relaxed">{{ store.currentPaper.abstract }}</p>
            </div>
          </div>

          <!-- Template QA -->
          <TemplateQA :paper-id="paperId" />

          <!-- Free QA -->
          <FreeQA :paper-id="paperId" />
        </div>
      </div>
    </div>
  </div>
</template>
