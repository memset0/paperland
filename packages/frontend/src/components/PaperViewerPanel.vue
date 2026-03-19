<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PdfViewer from '@/components/PdfViewer.vue'

interface ViewerMode {
  id: string
  label: string
  available: boolean
  type: 'pdf' | 'iframe'
  url?: string | null
}

const props = defineProps<{
  pdfPath: string | null
  arxivId: string | null
}>()

const modes = computed<ViewerMode[]>(() => {
  const list: ViewerMode[] = []
  list.push({
    id: 'pdf',
    label: 'PDF 原文',
    available: !!props.pdfPath,
    type: 'pdf',
  })
  list.push({
    id: 'translation',
    label: '幻觉翻译',
    available: !!props.arxivId,
    type: 'iframe',
    url: props.arxivId ? `https://hjfy.top/arxiv/${props.arxivId}` : null,
  })
  return list
})

const availableModes = computed(() => modes.value.filter(m => m.available))

const activeId = ref<string>('')

// Auto-select first available mode on change
watch(availableModes, (newModes) => {
  if (newModes.length > 0 && !newModes.find(m => m.id === activeId.value)) {
    activeId.value = newModes[0].id
  }
}, { immediate: true })

const activeMode = computed(() => modes.value.find(m => m.id === activeId.value) ?? null)
</script>

<template>
  <div class="h-full flex flex-col bg-gray-100/60">
    <!-- No modes available -->
    <div v-if="availableModes.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-3 stroke-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
      <p class="text-sm">暂无可用的查看模式</p>
      <p class="text-xs mt-1">等待服务下载 PDF 或补充 arXiv ID...</p>
    </div>

    <!-- Has modes -->
    <template v-else>
      <!-- Tab bar -->
      <div class="flex items-center justify-center border-b border-gray-200 bg-white shrink-0 px-1">
        <button
          v-for="mode in availableModes"
          :key="mode.id"
          @click="activeId = mode.id"
          class="px-3 py-2 text-xs font-medium transition-colors relative"
          :class="activeId === mode.id
            ? 'text-indigo-600'
            : 'text-gray-500 hover:text-gray-700'"
        >
          {{ mode.label }}
          <span
            v-if="activeId === mode.id"
            class="absolute bottom-0 left-1 right-1 h-0.5 bg-indigo-600 rounded-full"
          />
        </button>
      </div>

      <!-- Viewer content -->
      <div class="flex-1 overflow-hidden">
        <PdfViewer v-if="activeMode?.type === 'pdf'" :pdf-path="pdfPath" />
        <iframe
          v-else-if="activeMode?.type === 'iframe' && activeMode.url"
          :src="activeMode.url"
          class="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>
    </template>
  </div>
</template>
