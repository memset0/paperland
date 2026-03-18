<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ pdfPath: string | null }>()

const pdfUrl = computed(() => {
  if (!props.pdfPath) return null
  return `/api/files/${encodeURIComponent(props.pdfPath)}`
})
</script>

<template>
  <div class="h-full bg-gray-100/60">
    <iframe
      v-if="pdfUrl"
      :src="pdfUrl"
      class="w-full h-full border-0"
      type="application/pdf"
    />
    <div v-else class="flex flex-col items-center justify-center h-full text-gray-400">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-3 stroke-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
      <p class="text-sm">暂无 PDF</p>
      <p class="text-xs mt-1">等待 arxiv 服务下载...</p>
    </div>
  </div>
</template>
