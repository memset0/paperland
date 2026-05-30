<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FileText } from '@lucide/vue'
import PdfViewer from '@/components/PdfViewer.vue'
import NoteWalkthrough from '@/components/notes/NoteWalkthrough.vue'
import { useNotesStore } from '@/stores/notes'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { requestedPdfTarget } from '@/composables/usePdfNavigation'

interface ViewerMode {
  id: string
  label: string
  available: boolean
  type: 'pdf' | 'iframe' | 'walkthrough'
  url?: string | null
}

const props = defineProps<{
  pdfPath: string | null
  arxivId: string | null
  paperId?: number | null
}>()

const notesStore = useNotesStore()

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
  // Walkthrough renders the small-notes tree as one Markdown doc; only when notes exist.
  list.push({
    id: 'walkthrough',
    label: 'Walk-through',
    available: notesStore.noteCount > 0,
    type: 'walkthrough',
  })
  return list
})

const availableModes = computed(() => modes.value.filter(m => m.available))

const activeId = ref<string>('')

watch(availableModes, (newModes) => {
  if (newModes.length > 0 && !newModes.find(m => m.id === activeId.value)) {
    activeId.value = newModes[0].id
  }
}, { immediate: true })

// A `paperland://…?pdf=…` anchor jump activates the PDF tab; PdfViewer then scrolls/highlights.
watch(requestedPdfTarget, (t) => {
  if (t && props.pdfPath && activeId.value !== 'pdf') activeId.value = 'pdf'
})
</script>

<template>
  <div class="h-full flex flex-col bg-muted/40">
    <div v-if="availableModes.length === 0" class="flex flex-col items-center justify-center h-full text-muted-foreground">
      <FileText class="h-12 w-12 mb-3 stroke-1" />
      <p class="text-sm">暂无可用的查看模式</p>
      <p class="text-xs mt-1">等待服务下载 PDF 或补充 arXiv ID...</p>
    </div>

    <Tabs v-else v-model="activeId" class="h-full flex flex-col gap-0">
      <div class="flex justify-center border-b bg-background shrink-0">
        <TabsList variant="line" class="h-9 rounded-none p-0">
          <TabsTrigger
            v-for="mode in availableModes" :key="mode.id"
            :value="mode.id"
            class="data-active:text-primary data-active:after:bg-primary"
          >
            {{ mode.label }}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent v-for="mode in availableModes" :key="mode.id" :value="mode.id" class="flex-1 overflow-hidden m-0">
        <PdfViewer v-if="mode.type === 'pdf'" :pdf-path="pdfPath" :paper-id="paperId" />
        <iframe
          v-else-if="mode.type === 'iframe' && mode.url"
          :src="mode.url"
          class="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
        <NoteWalkthrough v-else-if="mode.type === 'walkthrough'" />
      </TabsContent>
    </Tabs>
  </div>
</template>
