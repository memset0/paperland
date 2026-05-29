<script setup lang="ts">
import { computed } from 'vue'
import { FileText } from '@lucide/vue'

const props = defineProps<{ pdfPath: string | null }>()

const pdfUrl = computed(() => {
  if (!props.pdfPath) return null
  return `/api/files/${encodeURIComponent(props.pdfPath)}`
})
</script>

<template>
  <div class="h-full bg-muted/40">
    <iframe
      v-if="pdfUrl"
      :src="pdfUrl"
      class="w-full h-full border-0"
      type="application/pdf"
    />
    <div v-else class="flex flex-col items-center justify-center h-full text-muted-foreground">
      <FileText class="h-12 w-12 mb-3 stroke-1" />
      <p class="text-sm">暂无 PDF</p>
      <p class="text-xs mt-1">等待 arxiv 服务下载...</p>
    </div>
  </div>
</template>
