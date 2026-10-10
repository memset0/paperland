<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { FileText } from '@lucide/vue'
import PdfViewer from '@/components/PdfViewer.vue'
import PdfUploadPanel from '@/components/PdfUploadPanel.vue'
import NoteWalkthrough from '@/components/notes/NoteWalkthrough.vue'
import Doc2xTranslationTab from '@/components/Doc2xTranslationTab.vue'
import { useDoc2xStore } from '@/stores/doc2x'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { requestedPdfTarget } from '@/composables/usePdfNavigation'
import { requestedPublicNote } from '@/composables/usePublicNoteOpen'
import { paperInfoRequests } from '@/composables/useQAConversation'

interface ViewerMode {
  id: string
  label: string
  available: boolean
  type: 'pdf' | 'iframe' | 'walkthrough' | 'doc2x' | 'metadata' | 'qa'
  url?: string | null
}

const props = defineProps<{
  pdfPath: string | null
  arxivId: string | null
  paperId?: number | null
  pdfStatus?: 'available' | 'fetching' | 'upload_required'
  pdfUnavailableReason?: 'closed_access' | 'download_failed' | 'not_found' | null
  /** Paper + conversation layout: add "Metadata" and "Q&A" tabs rendering the same-named slots. */
  infoTabs?: boolean
}>()

const doc2x = useDoc2xStore()

const modes = computed<ViewerMode[]>(() => {
  const list: ViewerMode[] = []
  list.push({
    id: 'pdf',
    label: 'PDF',
    // Always shown: without a PDF the tab renders PdfUploadPanel (fetching / upload required).
    available: true,
    type: 'pdf',
  })
  // doc2x preserved-layout translation (bilingual / translation-only). Never the auto-default:
  // pickDefault() takes the first non-Note mode and "PDF" always precedes it.
  list.push({
    id: 'doc2x',
    label: 'Bilingual PDF',
    available: !!props.pdfPath && !!doc2x.status?.enabled,
    type: 'doc2x',
  })
  list.push({
    id: 'translation',
    label: 'hjfy.top',
    available: !!props.arxivId,
    type: 'iframe',
    url: props.arxivId ? `https://hjfy.top/arxiv/${props.arxivId}` : null,
  })
  // The note document view ("Note") is always available — it renders an empty state when the
  // paper has no note yet (or for anonymous users).
  list.push({
    id: 'walkthrough',
    label: 'Note',
    available: true,
    type: 'walkthrough',
  })
  list.push({ id: 'metadata', label: 'Metadata', available: !!props.infoTabs, type: 'metadata' })
  list.push({ id: 'qa', label: 'Q&A', available: !!props.infoTabs, type: 'qa' })
  return list
})

const availableModes = computed(() => modes.value.filter(m => m.available))

const activeId = ref<string>('')

// Whether the active tab was chosen explicitly — by a user click or a deep link — rather than
// by the automatic default. Once chosen, the auto-default below stops overriding it.
const userChose = ref(false)

// The "Note" tab is always available, so before the paper's pdf_path / arxiv_id finish loading
// it is the *only* available mode — and a naive "first available" rule would latch onto it and
// never switch away once PDF / translation appear (Note stays valid). To avoid defaulting into
// the note, the automatic default prefers a primary viewer (PDF / translation) and only falls
// back to Note when it is the sole available mode. Explicit selections are never overridden.
function pickDefault(list: ViewerMode[]) {
  return list.find(m => m.id !== 'walkthrough') ?? list[0]
}

watch(availableModes, (newModes) => {
  if (userChose.value) {
    // Keep the explicit choice; only re-pick if that mode has disappeared.
    if (newModes.length > 0 && !newModes.find(m => m.id === activeId.value)) {
      activeId.value = newModes[0].id
    }
    return
  }
  const preferred = pickDefault(newModes)
  activeId.value = preferred ? preferred.id : ''
}, { immediate: true })

// A user clicking a tab pins that mode as their explicit choice.
function selectMode(id: string | number) {
  activeId.value = String(id)
  userChose.value = true
}

// A `paperland://…?pdf=…` anchor jump activates the PDF tab; PdfViewer then scrolls/highlights.
watch(requestedPdfTarget, (t) => {
  if (t && props.pdfPath) { activeId.value = 'pdf'; userChose.value = true }
})

// A `?note=` deep link (another user's public note) activates the Note tab; PublicNotesPanel
// then expands that entry and scrolls to it.
watch(requestedPublicNote, (r) => {
  if (r) { activeId.value = 'walkthrough'; userChose.value = true }
})

// Revealing a Q&A entry needs the Q&A tab (when present) to be the active one.
watch(paperInfoRequests, () => {
  if (props.infoTabs) { activeId.value = 'qa'; userChose.value = true }
})

// Opened from the paper list's note-status link (`?view=note`): activate the "Note" tab.
const route = useRoute()
watch(() => route.query.view, (v) => {
  if (v === 'note' && availableModes.value.some((m) => m.id === 'walkthrough')) {
    activeId.value = 'walkthrough'
    userChose.value = true
  }
}, { immediate: true })
</script>

<template>
  <div class="h-full flex flex-col bg-muted/40">
    <div v-if="availableModes.length === 0" class="flex flex-col items-center justify-center h-full text-muted-foreground">
      <FileText class="h-12 w-12 mb-3 stroke-1" />
      <p class="text-sm">No view available</p>
      <p class="text-xs mt-1">Waiting for the PDF download or an arXiv ID…</p>
    </div>

    <Tabs v-else :model-value="activeId" @update:model-value="selectMode" class="h-full flex flex-col gap-0">
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
        <template v-if="mode.type === 'pdf'">
          <PdfViewer v-if="pdfPath" :pdf-path="pdfPath" :paper-id="paperId" />
          <PdfUploadPanel v-else :paper-id="paperId ?? null" :pdf-status="pdfStatus" :reason="pdfUnavailableReason" />
        </template>
        <iframe
          v-else-if="mode.type === 'iframe' && mode.url"
          :src="mode.url"
          class="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
        <Doc2xTranslationTab v-else-if="mode.type === 'doc2x'" />
        <NoteWalkthrough v-else-if="mode.type === 'walkthrough'" />
        <slot v-else-if="mode.type === 'metadata'" name="metadata" />
        <slot v-else-if="mode.type === 'qa'" name="qa" />
      </TabsContent>
    </Tabs>
  </div>
</template>
