<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { FileText } from 'lucide-vue-next'

const props = defineProps<{ pdfPath: string | null }>()
const container = ref<HTMLDivElement>()
const loading = ref(false)
const error = ref('')

async function renderPdf(path: string) {
  if (!container.value) return
  loading.value = true
  error.value = ''
  container.value.innerHTML = ''

  try {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

    // Fetch PDF with credentials, then pass data to pdfjs
    const url = `/api/files/${encodeURIComponent(path)}`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`)
    const data = new Uint8Array(await response.arrayBuffer())
    const pdf = await pdfjsLib.getDocument({ data }).promise

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const scale = (container.value!.clientWidth - 32) / page.getViewport({ scale: 1 }).width
      const viewport = page.getViewport({ scale: Math.min(scale, 2) })

      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = '100%'
      canvas.style.height = 'auto'
      canvas.style.marginBottom = '8px'
      canvas.style.borderRadius = '4px'
      canvas.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'

      container.value!.appendChild(canvas)
      const ctx = canvas.getContext('2d')!
      await page.render({ canvasContext: ctx, viewport }).promise
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to load PDF'
  } finally {
    loading.value = false
  }
}

onMounted(() => { if (props.pdfPath) renderPdf(props.pdfPath) })
watch(() => props.pdfPath, (v) => { if (v) renderPdf(v) })
</script>

<template>
  <div class="h-full overflow-y-auto bg-gray-100/60 p-4">
    <div v-if="!pdfPath" class="flex flex-col items-center justify-center h-full text-gray-400">
      <FileText class="h-12 w-12 mb-3 stroke-1" />
      <p class="text-sm">暂无 PDF</p>
      <p class="text-xs mt-1">等待 arxiv 服务下载...</p>
    </div>
    <div v-else-if="loading" class="flex items-center justify-center h-full">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600"></div>
    </div>
    <div v-else-if="error" class="flex flex-col items-center justify-center h-full text-gray-400">
      <p class="text-sm text-red-500">{{ error }}</p>
    </div>
    <div ref="container"></div>
  </div>
</template>
