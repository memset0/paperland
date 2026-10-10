<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { FileUp, Loader2, Lock, TriangleAlert, FileQuestion } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { usePapersStore } from '@/stores/papers'
import { useAuthStore } from '@/stores/auth'

// Shown in the "PDF" tab when the paper has no PDF: either a "fetching" state (a service
// may still obtain one — polls the paper until the status changes) or an upload prompt
// explaining why no PDF could be obtained automatically.
const props = defineProps<{
  paperId: number | null
  pdfStatus?: 'available' | 'fetching' | 'upload_required'
  reason?: 'closed_access' | 'download_failed' | 'not_found' | null
}>()

const store = usePapersStore()
const auth = useAuthStore()

const POLL_MS = 5000
let timer: ReturnType<typeof setInterval> | null = null
function stopPolling() {
  if (timer) { clearInterval(timer); timer = null }
}
watch(() => props.pdfStatus, (s) => {
  stopPolling()
  if (s === 'fetching') timer = setInterval(() => { store.refreshCurrentPaper().catch(() => {}) }, POLL_MS)
}, { immediate: true })
onUnmounted(stopPolling)

const reasonInfo = computed(() => {
  switch (props.reason) {
    case 'closed_access':
      return { icon: Lock, text: "This paper isn't open access; Semantic Scholar has no open PDF for it." }
    case 'download_failed':
      return { icon: TriangleAlert, text: "Automatic PDF download failed (the source refused access or didn't return a PDF)." }
    default:
      return { icon: FileQuestion, text: 'No downloadable PDF source was found.' }
  }
})

const uploading = ref(false)
const error = ref('')
const dragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

async function uploadFile(file: File | undefined | null) {
  if (!file || props.paperId == null || uploading.value) return
  error.value = ''
  if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    error.value = 'Choose a PDF file.'
    return
  }
  uploading.value = true
  try {
    // The store replaces currentPaper with the response, so pdf_path appears and the
    // viewer swaps this panel for the PDF.
    await store.uploadPdf(props.paperId, file)
  } catch (e: any) {
    error.value = e?.message || 'Upload failed'
  } finally {
    uploading.value = false
  }
}

function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  uploadFile(input.files?.[0])
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  if (!auth.isAuthenticated) return
  uploadFile(e.dataTransfer?.files?.[0])
}
</script>

<template>
  <div class="h-full flex items-center justify-center p-6">
    <div v-if="pdfStatus === 'fetching'" class="flex flex-col items-center text-muted-foreground">
      <Loader2 class="h-10 w-10 mb-3 stroke-1 animate-spin" />
      <p class="text-sm">Fetching PDF…</p>
      <p class="text-xs mt-1">Downloading from arXiv / Semantic Scholar; it will appear automatically.</p>
    </div>

    <div
      v-else
      class="w-full max-w-md rounded-lg border-2 border-dashed p-8 flex flex-col items-center text-center transition-colors"
      :class="dragOver ? 'border-primary bg-primary/5' : 'border-border bg-background/60'"
      @dragover.prevent="dragOver = auth.isAuthenticated"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <component :is="reasonInfo.icon" class="h-10 w-10 mb-3 stroke-1 text-muted-foreground" />
      <p class="text-sm font-medium">PDF needed</p>
      <p class="text-xs text-muted-foreground mt-1">{{ reasonInfo.text }}</p>
      <p class="text-xs text-muted-foreground">Upload a PDF to read, parse and translate it.</p>

      <template v-if="auth.isAuthenticated">
        <input ref="fileInput" type="file" accept="application/pdf,.pdf" class="hidden" @change="onPick" />
        <Button class="mt-4" size="sm" :disabled="uploading || paperId == null" @click="fileInput?.click()">
          <Loader2 v-if="uploading" class="animate-spin" />
          <FileUp v-else />
          {{ uploading ? 'Uploading…' : 'Choose PDF' }}
        </Button>
        <p class="text-xs text-muted-foreground mt-2">or drop a PDF here</p>
      </template>
      <p v-else class="text-xs text-muted-foreground mt-4">Log in to upload a PDF</p>

      <p v-if="error" class="text-xs text-destructive mt-3">{{ error }}</p>
    </div>
  </div>
</template>
