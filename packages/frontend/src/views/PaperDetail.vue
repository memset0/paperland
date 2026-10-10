<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch, nextTick, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePapersStore } from '@/stores/papers'
import { useQAStore } from '@/stores/qa'
import { useDoc2xStore } from '@/stores/doc2x'
import { useBlockAnchor } from '@/composables/useBlockAnchor'
import { usePdfNavigation } from '@/composables/usePdfNavigation'
import { usePublicNoteOpen } from '@/composables/usePublicNoteOpen'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'vue-sonner'
import { ArrowLeft, ExternalLink, Calendar, Users, Tag, ChevronsUpDown, ChevronsDownUp, PanelLeftClose, PanelLeftOpen, Columns2, Columns3, MessagesSquare, RefreshCw, Pencil, Trash2, X, Save, Loader2, Bot, BookmarkPlus, BookmarkCheck } from '@lucide/vue'
import SourceTag from '@/components/SourceTag.vue'
import S2Badge from '@/components/S2Badge.vue'
import TagBadge from '@/components/TagBadge.vue'
import TagSelector from '@/components/TagSelector.vue'
import { useTagsStore } from '@/stores/tags'
import { api, notesApi } from '@/api/client'
import { useEmbedMode } from '@/composables/useEmbedMode'
import { usePageTitle } from '@/composables/usePageTitle'
import PaperViewerPanel from '@/components/PaperViewerPanel.vue'
import QAList from '@/components/QAList.vue'
import PaperNotesCard from '@/components/PaperNotesCard.vue'
import ReferenceLinksSection from '@/components/ReferenceLinksSection.vue'
import PaperFullTextCopy from '@/components/PaperFullTextCopy.vue'
import PaperCitations from '@/components/PaperCitations.vue'
import QAInput from '@/components/QAInput.vue'
import BilingualText from '@/components/BilingualText.vue'
import PaperActionLauncher, { type LauncherAction } from '@/components/PaperActionLauncher.vue'
import { useQAWindow, QA_DEFAULT_HEIGHT } from '@/composables/useQAWindow'
import { useWindowsStore } from '@/stores/windows'
import { useQAComposer } from '@/composables/useQAComposer'
import QAPanelNav from '@/components/QAPanelNav.vue'
import QAConversationPanel from '@/components/QAConversationPanel.vue'
import { useQAConversation, clampSplitLeft, clampThree, type PaperLayout } from '@/composables/useQAConversation'
import { createReusableTemplate } from '@vueuse/core'
import MarkdownContent from '@/components/MarkdownContent.vue'
import { useHighlightStore } from '@/stores/highlights'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

const route = useRoute()
const router = useRouter()
const store = usePapersStore()
const qaStore = useQAStore()
const doc2xStore = useDoc2xStore()
const highlightStore = useHighlightStore()
const tagsStore = useTagsStore()
const { isEmbed } = useEmbedMode()
const { locateBlock, revealQAEntry } = useBlockAnchor()
const { requestPdfNavigation } = usePdfNavigation()
const { requestPublicNote } = usePublicNoteOpen()
const auth = useAuthStore()
const paperId = computed(() => parseInt(route.params.id as string, 10))

// Browser tab title follows the paper; shows a placeholder until it loads.
usePageTitle(() => store.currentPaper?.title ?? 'Paper Detail')

// Semantic Scholar enrichment surfaced from paper.metadata (null if none present).
const s2meta = computed(() => {
  const m = (store.currentPaper?.metadata ?? {}) as any
  const citationCount = m.citation_count
  const influentialCount = m.influential_citation_count
  const tldr = m.tldr
  if (citationCount === undefined && influentialCount === undefined && !tldr) return null
  return { citationCount, influentialCount, tldr }
})

function reloadPage() { window.location.reload() }

const isWide = ref(window.innerWidth >= 900)
function onResize() { isWide.value = window.innerWidth >= 900 }
const showSplitView = computed(() => isWide.value && !isEmbed.value)

// ---- Wide layouts: split / paper + conversation / three columns (see useQAConversation) ----
const conversation = useQAConversation()
watch(() => [auth.user?.id, paperId.value] as const, ([userId, id]) => conversation.bind(userId, id), { immediate: true })
watch(() => showSplitView.value && auth.isAuthenticated, (value) => conversation.setAvailable(value), { immediate: true })

/** The effective layout: conversation layouts only where the view is available. */
const layout = computed<PaperLayout>(() => conversation.available.value ? conversation.layout.value : 'split')
const layoutOptions: Array<{ value: PaperLayout; label: string; icon: Component }> = [
  { value: 'split', label: 'Two columns', icon: Columns2 },
  { value: 'split-conv', label: 'Paper + conversation', icon: MessagesSquare },
  { value: 'three', label: 'Three columns', icon: Columns3 },
]

/** Left (viewer) column width in % of the split container. */
const leftWidth = computed(() => layout.value === 'three' ? conversation.three.value.left : conversation.splitLeft.value)
const dragging = ref(false)
const collapsed = ref(false)

/** Pointer position as % of the split container width, from its left edge. */
function containerPercent(clientX: number): number | null {
  const rect = document.getElementById('split-container')?.getBoundingClientRect()
  if (!rect || rect.width === 0) return null
  return ((clientX - rect.left) / rect.width) * 100
}

function onPointerDown(e: PointerEvent) {
  if (collapsed.value) return
  dragging.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  const pct = containerPercent(e.clientX)
  if (pct == null) return
  if (layout.value === 'three') conversation.three.value = clampThree(pct, conversation.three.value.conv, 'left')
  else conversation.splitLeft.value = clampSplitLeft(pct)
}
function onPointerUp(e: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
}

function toggleCollapse() {
  collapsed.value = !collapsed.value
}

// Three-column layout: the divider between the Q&A column and the conversation column.
const convDragging = ref(false)
function onConvPointerDown(e: PointerEvent) {
  convDragging.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onConvPointerMove(e: PointerEvent) {
  if (!convDragging.value) return
  const pct = containerPercent(e.clientX)
  if (pct == null) return
  conversation.three.value = clampThree(conversation.three.value.left, 100 - pct, 'conv')
}
function onConvPointerUp(e: PointerEvent) {
  if (!convDragging.value) return
  convDragging.value = false
  ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
}

// The paper info & Q&A column is defined once and placed either whole as the middle column
// (split, three) or split across the viewer's "Metadata" and "Q&A" tabs (paper + conversation).
type PaperColumnPart = 'all' | 'metadata' | 'qa'
const [DefineMetadata, Metadata] = createReusableTemplate()
const [DefinePaperColumn, PaperColumn] = createReusableTemplate<{ part: PaperColumnPart }>()

// ---- Paper-detail function launcher (top-right list / mobile FAB) + QA window ----
const qaWin = useQAWindow()
const floatingWindows = useWindowsStore()
const composer = useQAComposer()

/**
 * Open the "Ask" panel with a default geometry computed fresh from the current
 * layout (default-placed at the content's bottom-left; never remembered, unlike
 * the notes window). The panel is then movable (drag empty areas) and resizable
 * (bottom-right grip). Mobile opens fullscreen, so its geometry is a placeholder.
 */
function openQA() {
  // The conversation view docks the question box; there is no floating panel while it is open.
  if (conversation.visible.value) return
  if (window.innerWidth < 768) {
    qaWin.open({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight })
    return
  }
  // Leave room for the follow-up line / attachment chips when the draft has them.
  const height = QA_DEFAULT_HEIGHT
    + (composer.followup.value ? 20 : 0)
    + (composer.attachments.value.length ? 28 : 0)
  const m = 12 // small inset so the default panel sits a bit smaller within the area
  if (showSplitView.value) {
    // Double-column: bottom-left within the left (PDF) column (sticking to the
    // previous QAInput placement rule; "一半" was loose wording).
    const rect = document.getElementById('split-container')?.getBoundingClientRect()
    const leftColW = rect ? (rect.width * leftWidth.value) / 100 : 0
    qaWin.open({
      left: (rect ? rect.left : 12) + m,
      top: Math.max(0, (rect ? rect.bottom : window.innerHeight) - height - m),
      width: Math.max(300, (Math.round(leftColW) || 460) - m * 2),
      height,
    })
  } else {
    // Single-column: bottom strip across the content area.
    const rect = narrowScrollRef.value?.getBoundingClientRect()
    qaWin.open({
      left: (rect ? rect.left : 0) + m,
      top: Math.max(0, (rect ? rect.bottom : window.innerHeight) - height - m),
      width: Math.max(300, (rect ? rect.width : window.innerWidth) - m * 2),
      height,
    })
  }
}

// PDF "Add to question", answer "Follow up", and #moonlight links ask for the question box.
watch(composer.openRequests, () => {
  if (!qaWin.isOpen.value && !conversation.visible.value) openQA()
})

// Ordered per the paper-detail function order (citations → notes → ask); only Ask today.
const paperActions = computed<LauncherAction[]>(() => [
  { key: 'ask', label: 'Ask', icon: Bot, onSelect: openQA },
])

/**
 * A `?note=<id>` link auto-opens another user's public note in the right panel. If the note is the
 * viewer's own, it's already in their Note tab — show a hint and don't auto-open. Unavailable notes
 * (deleted / not readable) get a brief notice and we just stay on the paper.
 */
async function handleNoteDeepLink(noteId: number) {
  const note = await notesApi.getById(noteId)
  if (!note) { toast.error('Note unavailable'); return }
  if (auth.user && note.user_id === auth.user.id) {
    toast.info('This is your own note — open it from the Note tab')
    return
  }
  requestPublicNote(noteId)
}

/** Jump to a `?note=<id>`, `?h=<hash>`, or `?pdf=<page>` deep-link target once the paper is present. */
function handleAnchorFromRoute() {
  // A note link opens the addressed public note in the right panel (own-note → hint, no auto-open).
  const note = route.query.note
  if (typeof note === 'string' && note) {
    const noteId = parseInt(note, 10)
    if (!Number.isNaN(noteId)) handleNoteDeepLink(noteId)
    return
  }
  // A Q&A link (`?qa=<entry>[&result=]`) reveals that entry; it was already routed to the paper
  // that actually owns the entry.
  const qa = route.query.qa
  if (typeof qa === 'string' && qa) {
    const entryId = parseInt(qa, 10)
    const result = typeof route.query.result === 'string' ? parseInt(route.query.result, 10) : null
    if (!Number.isNaN(entryId)) {
      revealQAEntry(entryId, result).then(() => {
        // `followup=1` (from the /qa feed): open the question box continuing that answer.
        if (route.query.followup !== '1' || result == null) return
        const entries = [...Object.values(qaStore.qaData.template), ...qaStore.qaData.free]
        const entry = entries.find((candidate) => candidate.entry_id === entryId)
        const target = entry?.results.find((candidate) => candidate.id === result)
        if (!entry || !target || target.status !== 'done') return
        const title = ('prompt' in entry && typeof entry.prompt === 'string' && entry.prompt) || `QA-${entryId}`
        const prefill = typeof route.query.fq === 'string' ? route.query.fq : undefined
        void composer.startFollowup({ result_id: result, entry_id: entryId, title, model_name: target.model_name }, prefill)
      })
    }
    return
  }
  // PDF page/region anchor takes precedence and routes to the embedded viewer.
  const pdf = route.query.pdf
  if (typeof pdf === 'string' && pdf) {
    const page = parseInt(pdf, 10)
    if (!Number.isNaN(page)) {
      const { rx, ry, rw, rh } = route.query
      const rect = [rx, ry, rw, rh].every((v) => typeof v === 'string')
        ? { x: Number(rx), y: Number(ry), w: Number(rw), h: Number(rh) }
        : null
      const ts = route.query.ts
      const te = route.query.te
      if (rect && Number.isFinite(rect.x) && Number.isFinite(rect.y) && rect.w > 0 && rect.h > 0) {
        // Rectangle wins over a text selection.
        requestPdfNavigation({ page, rect })
      } else if (typeof ts === 'string' && typeof te === 'string') {
        requestPdfNavigation({ page, ts: parseInt(ts, 10), te: parseInt(te, 10) })
      } else {
        requestPdfNavigation({ page })
      }
    }
    return
  }
  const h = route.query.h
  if (typeof h !== 'string' || !h) return
  const s = route.query.s
  const e = route.query.e
  const range = typeof s === 'string' && typeof e === 'string'
    ? { start: parseInt(s, 10), end: parseInt(e, 10) }
    : null
  locateBlock(paperId.value, h, range)
}

async function loadPaperData() {
  await store.fetchPaper(paperId.value)
  highlightStore.loadForPathname(route.path)
  qaStore.switchPaper(paperId.value)
  doc2xStore.load(paperId.value) // doc2x parse/translate status (viewer tab + full-text copy)
  await qaStore.fetchQA(paperId.value, true)
}

onMounted(async () => {
  window.addEventListener('resize', onResize)
  tagsStore.ensureLoaded()
  await qaStore.fetchTemplates()
  await loadPaperData()
  await nextTick()
  handleAnchorFromRoute()
})

// Anchor deep-links (`/papers/:id?h=`) and cross-paper anchor jumps. RouterView is not
// keyed, so navigating paper→paper reuses this component — reload data on id change.
watch(() => [route.params.id, route.query.qa, route.query.result, route.query.note, route.query.h, route.query.s, route.query.e, route.query.pdf, route.query.ts, route.query.te, route.query.rx, route.query.ry, route.query.rw, route.query.rh], async (next, prev) => {
  if (next[0] !== prev[0]) {
    qaWin.close() // don't carry an open QA window across papers
    floatingWindows.closeKind('qa-tree') // the tree shows the current paper's Q&A
    await loadPaperData()
  }
  await nextTick()
  handleAnchorFromRoute()
})

function navigateToTagFilter(tagId: number) {
  router.push({ path: '/papers', query: { tags: String(tagId) } })
}

const isEditingTags = ref(false)
const editingTags = ref<string[]>([])
const savingTags = ref(false)

function startEditTags() {
  const tags = (store.currentPaper as any)?.tags || []
  editingTags.value = tags.map((t: any) => typeof t === 'string' ? t : t.name)
  isEditingTags.value = true
}

function cancelEditTags() {
  isEditingTags.value = false
  editingTags.value = []
}

async function saveTags() {
  savingTags.value = true
  try {
    await api.put(`/api/papers/${paperId.value}/tags`, { tags: editingTags.value })
    await store.fetchPaper(paperId.value)
    await tagsStore.refreshCache()
    isEditingTags.value = false
  } finally {
    savingTags.value = false
  }
}

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  qaStore.stopPolling()
  doc2xStore.release()
  qaWin.close()
  floatingWindows.closeKind('qa-tree')
})

const summaryFaqs = computed(() => {
  const meta = store.currentPaper?.metadata
  if (!meta || typeof meta !== 'object') return null
  const raw = (meta as Record<string, unknown>).papers_cool_summary
  if (typeof raw !== 'string' || raw.length === 0) return null

  const parts = raw.split(/(?=Q\d+[:：])/)
  const faqs: Array<{ question: string; answer: string }> = []
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const match = trimmed.match(/^Q\d+[:：]\s*(.+?)(?:\n\n|\n)([\s\S]*)$/)
    if (match) {
      faqs.push({ question: match[1].trim(), answer: match[2].trim() })
    }
  }
  return faqs.length > 0 ? faqs : null
})

const papersCoolUrl = computed(() => {
  const id = store.currentPaper?.arxiv_id
  return id ? `https://papers.cool/arxiv/${id}` : null
})

const kimiOpenMap = ref<Record<number, boolean>>({})

function setAllKimiOpen(open: boolean) {
  if (!summaryFaqs.value) return
  for (let i = 0; i < summaryFaqs.value.length; i++) {
    kimiOpenMap.value[i] = open
  }
}

/** Scroll container of the Q&A lists (middle column or Q&A tab), for QAPanelNav. */
const wideScrollRef = ref<HTMLElement | null>(null)
function setPaperScroll(el: unknown, part: PaperColumnPart) {
  if (part === 'metadata') return
  if (el) wideScrollRef.value = el as HTMLElement
  else if (wideScrollRef.value && !wideScrollRef.value.isConnected) wideScrollRef.value = null
}
const narrowScrollRef = ref<HTMLElement | null>(null)

const qaNavEntries = computed(() => {
  const entries: Array<{ key: string; title: string }> = []
  for (const tmpl of qaStore.templates) {
    const data = qaStore.qaData.template[tmpl.name]
    if (data && data.results.length > 0) {
      entries.push({ key: 'tmpl-' + tmpl.name, title: tmpl.prompt })
    }
  }
  for (const entry of qaStore.qaData.free) {
    entries.push({ key: 'free-' + entry.entry_id, title: entry.prompt || 'Free question' })
  }
  return entries
})

const editing = ref(false)
const saving = ref(false)
const editForm = ref({ title: '', authors: '', link: '', content: '' })

const isArxiv = computed(() => !!store.currentPaper?.arxiv_id)

function enterEditMode() {
  const p = store.currentPaper
  if (!p) return
  editForm.value = {
    title: p.title || '',
    authors: Array.isArray(p.authors) ? p.authors.join(', ') : '',
    link: p.link || '',
    content: p.contents?.user_input || '',
  }
  editing.value = true
}

function cancelEdit() {
  editing.value = false
}

async function saveEdit() {
  const p = store.currentPaper
  if (!p) return
  saving.value = true
  try {
    const data: Record<string, any> = {}
    if (!isArxiv.value) {
      if (editForm.value.title !== (p.title || '')) data.title = editForm.value.title
      const newAuthors = editForm.value.authors.split(',').map(s => s.trim()).filter(Boolean)
      const oldAuthors = Array.isArray(p.authors) ? p.authors : []
      if (JSON.stringify(newAuthors) !== JSON.stringify(oldAuthors)) data.authors = newAuthors
    }
    if (editForm.value.link !== (p.link || '')) data.link = editForm.value.link
    const oldContent = p.contents?.user_input || ''
    if (editForm.value.content !== oldContent) data.content = editForm.value.content

    if (Object.keys(data).length > 0) {
      await store.updatePaper(p.id, data)
      await store.fetchPaper(p.id)
    }
    editing.value = false
  } finally {
    saving.value = false
  }
}

const showDeleteDialog = ref(false)
const deleteConfirmId = ref('')
const deleting = ref(false)

const deleteIdMatch = computed(() => deleteConfirmId.value === String(store.currentPaper?.id))

async function confirmDelete() {
  if (!deleteIdMatch.value) return
  deleting.value = true
  try {
    await store.deletePaper(store.currentPaper!.id)
    router.push('/papers')
  } finally {
    deleting.value = false
  }
}

const libraryBusy = ref(false)
async function toggleInLibrary() {
  const paper = store.currentPaper
  if (!paper || !auth.user) return
  libraryBusy.value = true
  try { await store.setInLibrary(paper.id, !paper.in_library) } finally { libraryBusy.value = false }
}

const promoting = ref(false)
async function promote() {
  if (!store.currentPaper) return
  promoting.value = true
  try {
    await store.promote(store.currentPaper.id)
    // Fetching a metadata-only paper is an add: put it in the user's own list too.
    if (auth.user) await store.setInLibrary(store.currentPaper.id, true)
  } catch {
    // Backend rejected — the API client already showed the error toast and the paper
    // stays unlisted.
  } finally {
    promoting.value = false
  }
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Paper info cards (everything above the Q&A lists) -->
    <DefineMetadata>
      <template v-if="store.currentPaper">
        <Card class="p-5">
          <template v-if="editing">
            <div class="space-y-3">
              <div class="space-y-1.5">
                <Label>Title</Label>
                <Input v-model="editForm.title" :disabled="isArxiv" />
              </div>
              <div class="space-y-1.5">
                <Label>Authors (comma-separated)</Label>
                <Input v-model="editForm.authors" :disabled="isArxiv" />
              </div>
              <div class="space-y-1.5">
                <Label>Source URL</Label>
                <Input v-model="editForm.link" placeholder="https://…" />
              </div>
              <div class="space-y-1.5">
                <Label>Content (user input)</Label>
                <Textarea v-model="editForm.content" rows="10" placeholder="Enter paper content…" class="font-mono resize-y" />
              </div>
              <div class="flex justify-end gap-2">
                <Button variant="outline" size="sm" @click="cancelEdit">
                  <X />Cancel
                </Button>
                <Button size="sm" :disabled="saving" @click="saveEdit">
                  <Save />{{ saving ? 'Saving…' : 'Save' }}
                </Button>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="flex items-start justify-between gap-3">
              <h2 class="text-lg font-semibold leading-snug">{{ store.currentPaper.title }}</h2>
              <div class="flex items-center gap-1 shrink-0">
                <Button
                  v-if="store.currentPaper.listed === false"
                  size="sm"
                  :disabled="promoting"
                  @click="promote"
                >
                  {{ promoting ? 'Adding…' : 'Add to list' }}
                </Button>
                <Button
                  v-if="auth.user"
                  variant="ghost" size="icon-sm"
                  :disabled="libraryBusy"
                  :title="store.currentPaper.in_library ? 'In my list — click to remove from my list' : 'Add to my list'"
                  :class="store.currentPaper.in_library ? 'text-primary' : ''"
                  @click="toggleInLibrary"
                >
                  <BookmarkCheck v-if="store.currentPaper.in_library" />
                  <BookmarkPlus v-else />
                </Button>
                <Button variant="ghost" size="icon-sm" title="Edit" @click="enterEditMode">
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon-sm" title="Delete" class="hover:text-destructive" @click="showDeleteDialog = true; deleteConfirmId = ''">
                  <Trash2 />
                </Button>
              </div>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <SourceTag :link="store.currentPaper.link" :arxiv-id="store.currentPaper.arxiv_id" />
              <S2Badge :corpus-id="store.currentPaper.corpus_id" :s2-url="(store.currentPaper.metadata as any)?.s2_url" />
              <Badge variant="outline" class="gap-1">
                <Calendar />{{ new Date(store.currentPaper.created_at).toLocaleDateString() }}
              </Badge>
            </div>
            <div v-if="store.currentPaper.authors?.length" class="space-y-2">
              <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Users class="h-3 w-3" /> Authors
              </div>
              <div class="flex flex-wrap gap-1">
                <Badge v-for="a in (Array.isArray(store.currentPaper.authors) ? store.currentPaper.authors : [])" :key="a" variant="secondary">{{ a }}</Badge>
              </div>
            </div>
            <div class="space-y-2">
              <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Tag class="h-3 w-3" /> Tags
                <Button v-if="!isEditingTags" variant="ghost" size="icon-xs" class="ml-auto" @click="startEditTags">
                  <Pencil />
                </Button>
              </div>
              <template v-if="isEditingTags">
                <TagSelector v-model="editingTags" />
                <div class="flex gap-2">
                  <Button size="sm" :disabled="savingTags" @click="saveTags">
                    {{ savingTags ? 'Saving…' : 'Save' }}
                  </Button>
                  <Button variant="ghost" size="sm" @click="cancelEditTags">Cancel</Button>
                </div>
              </template>
              <template v-else>
                <div v-if="(store.currentPaper as any).tags?.length" class="flex flex-wrap gap-1">
                  <TagBadge v-for="t in (store.currentPaper as any).tags" :key="t.id || t" :tag-id="t.id || 0" :tag-name="t.name || t" clickable @click="navigateToTagFilter(t.id)" />
                </div>
                <Button v-else variant="link" size="xs" @click="startEditTags">+ Add tag</Button>
              </template>
            </div>
            <PaperFullTextCopy :paper-id="paperId" />
            <ReferenceLinksSection :paper-id="paperId" />
            <div v-if="store.currentPaper.abstract" class="space-y-2">
              <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Abstract</div>
              <BilingualText :text="store.currentPaper.abstract || ''" />
            </div>
            <div v-if="s2meta" class="space-y-2">
              <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Semantic Scholar</div>
              <div class="flex flex-wrap gap-1.5">
                <Badge v-if="s2meta.citationCount !== undefined" variant="secondary">{{ s2meta.citationCount }} {{ s2meta.citationCount === 1 ? 'citation' : 'citations' }}</Badge>
                <Badge v-if="s2meta.influentialCount !== undefined" variant="outline">influential {{ s2meta.influentialCount }}</Badge>
              </div>
              <p v-if="s2meta.tldr" class="text-sm text-muted-foreground leading-relaxed"><span class="font-medium text-foreground">TL;DR </span>{{ s2meta.tldr }}</p>
            </div>
          </template>
        </Card>

        <PaperCitations :paper-id="paperId" />

        <PaperNotesCard :paper-id="paperId" />

        <Card v-if="summaryFaqs" class="overflow-hidden gap-0 py-0">
          <div class="flex items-center justify-between border-b px-5 py-3">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-semibold">Kimi summary</h3>
              <a v-if="papersCoolUrl" :href="papersCoolUrl" target="_blank" rel="noopener noreferrer"
                class="inline-flex items-center gap-0.5 text-xs text-primary hover:underline">
                (papers.cool) <ExternalLink class="h-2.5 w-2.5" />
              </a>
            </div>
            <div class="flex items-center gap-1.5">
              <Button variant="ghost" size="icon-sm" title="Expand all" @click="setAllKimiOpen(true)">
                <ChevronsUpDown />
              </Button>
              <Button variant="ghost" size="icon-sm" title="Collapse all" @click="setAllKimiOpen(false)">
                <ChevronsDownUp />
              </Button>
            </div>
          </div>
          <div class="divide-y">
            <Collapsible
              v-for="(faq, i) in summaryFaqs" :key="i"
              :open="kimiOpenMap[i] || false"
              @update:open="(v: boolean) => kimiOpenMap[i] = v"
            >
              <CollapsibleTrigger class="flex w-full items-center gap-3 px-5 py-3 cursor-pointer hover:bg-muted/40 transition-colors text-left">
                <span class="text-xs font-semibold shrink-0 text-muted-foreground">Q{{ i + 1 }}</span>
                <div class="flex-1 min-w-0">
                  <span class="text-sm font-semibold">{{ faq.question }}</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent class="px-5 pb-4 pt-1">
                <MarkdownContent :content="faq.answer" :paper-id="paperId" class="text-sm" />
              </CollapsibleContent>
            </Collapsible>
          </div>
        </Card>
      </template>
    </DefineMetadata>

    <!-- The info & Q&A column: whole (split / three columns) or one part per viewer tab (paper + conversation) -->
    <DefinePaperColumn v-slot="{ part }">
      <div :ref="(el) => setPaperScroll(el, part)" class="h-full overflow-y-auto relative" :data-paper-column="part">
        <div v-if="store.loading" class="flex items-center justify-center h-full">
          <Loader2 class="h-5 w-5 animate-spin text-primary" />
        </div>
        <div v-else-if="store.currentPaper" class="p-5 space-y-5 pb-40">
          <Metadata v-if="part !== 'qa'" />
          <QAList v-if="part !== 'metadata'" :paper-id="paperId" />
        </div>
        <QAPanelNav v-if="store.currentPaper && part !== 'metadata'" :entries="qaNavEntries" :scroll-container="wideScrollRef" :paper-id="paperId" />
      </div>
    </DefinePaperColumn>

    <!-- Embed: compact header -->
    <div v-if="isEmbed" class="flex h-6 items-center gap-1 border-b px-2 shrink-0">
      <div class="min-w-0 flex-1">
        <h1 class="text-[11px] font-medium text-muted-foreground truncate">{{ store.currentPaper?.title || '' }}</h1>
      </div>
      <Button variant="ghost" size="icon-xs" title="Reload page" @click="reloadPage">
        <RefreshCw />
      </Button>
    </div>
    <!-- Normal header -->
    <div v-else class="flex h-12 items-center gap-3 border-b bg-background px-4 shrink-0">
      <Button variant="ghost" size="icon-sm" @click="router.push('/papers')">
        <ArrowLeft />
      </Button>
      <div class="min-w-0 flex-1">
        <h1 class="text-sm font-semibold truncate">{{ store.currentPaper?.title || 'Loading…' }}</h1>
      </div>
      <div
        v-if="store.currentPaper && conversation.available.value"
        class="flex shrink-0 items-center rounded-md border p-0.5"
        role="radiogroup"
        aria-label="Page layout"
        data-layout-selector
      >
        <Button
          v-for="option in layoutOptions" :key="option.value"
          variant="ghost" size="icon-sm"
          role="radio"
          :aria-checked="layout === option.value"
          :title="option.label"
          :data-layout="option.value"
          :class="layout === option.value ? 'bg-muted text-foreground' : 'text-muted-foreground'"
          @click="conversation.setLayout(option.value)"
        >
          <component :is="option.icon" />
        </Button>
      </div>
      <PaperActionLauncher v-if="store.currentPaper" :actions="paperActions" />
    </div>

    <!-- Wide screen: split view -->
    <div v-if="showSplitView" id="split-container" class="flex flex-1 overflow-hidden" :class="{ 'select-none': dragging || convDragging }">
      <div
        :style="{ width: collapsed ? '0%' : leftWidth + '%' }"
        class="shrink-0 overflow-hidden relative"
        data-viewer-column
        :class="{ 'transition-[width] duration-300 ease-in-out': !dragging }"
      >
        <PaperViewerPanel
          :pdf-path="store.currentPaper?.pdf_path || null"
          :arxiv-id="store.currentPaper?.arxiv_id || null"
          :paper-id="paperId"
          :pdf-status="store.currentPaper?.pdf_status"
          :pdf-unavailable-reason="store.currentPaper?.pdf_unavailable_reason"
          :info-tabs="layout === 'split-conv'"
        >
          <template #metadata><PaperColumn part="metadata" /></template>
          <template #qa><PaperColumn part="qa" /></template>
        </PaperViewerPanel>
      </div>

      <div
        class="shrink-0 relative flex items-center justify-center touch-none group bg-border transition-colors"
        :class="[
          collapsed ? 'cursor-default' : 'cursor-col-resize',
          dragging ? 'bg-ring' : 'hover:bg-ring/60',
        ]"
        :style="{ width: '2px' }"
        @pointerdown.prevent="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
      >
        <div class="absolute inset-y-0 -left-[5px] -right-[5px]"></div>
        <Button
          variant="outline" size="icon-sm"
          class="absolute z-10 rounded-full opacity-0 group-hover:opacity-100"
          @pointerdown.stop
          @click.stop="toggleCollapse"
        >
          <PanelLeftOpen v-if="collapsed" />
          <PanelLeftClose v-else />
        </Button>
      </div>

      <div v-if="layout !== 'split-conv'" class="min-w-0 flex-1">
        <PaperColumn part="all" />
      </div>

      <!-- Conversation view: right column (paper + conversation) or resizable third column -->
      <template v-if="conversation.visible.value && store.currentPaper">
        <div
          v-if="layout === 'three'"
          class="shrink-0 relative touch-none cursor-col-resize bg-border transition-colors"
          :class="convDragging ? 'bg-ring' : 'hover:bg-ring/60'"
          :style="{ width: '2px' }"
          title="Drag to resize the conversation panel"
          data-conv-divider
          @pointerdown.prevent="onConvPointerDown"
          @pointermove="onConvPointerMove"
          @pointerup="onConvPointerUp"
        >
          <div class="absolute inset-y-0 -left-[5px] -right-[5px]"></div>
        </div>
        <div
          class="overflow-hidden"
          :class="layout === 'three' ? 'shrink-0' : 'min-w-0 flex-1'"
          :style="layout === 'three' ? { width: conversation.three.value.conv + '%' } : undefined"
          data-conv-column
        >
          <QAConversationPanel :paper-id="paperId" />
        </div>
      </template>
    </div>

    <!-- Narrow screen -->
    <div v-else ref="narrowScrollRef" class="flex-1 overflow-y-auto relative">
      <div v-if="store.loading" class="flex items-center justify-center py-20">
        <Loader2 class="h-5 w-5 animate-spin text-primary" />
      </div>
      <div v-else-if="store.currentPaper" :class="isEmbed ? 'p-1.5 space-y-1.5' : 'p-5 space-y-5 max-w-3xl mx-auto pb-40'">
        <Card :class="isEmbed ? 'p-3' : 'p-5'">
          <template v-if="editing">
            <div class="space-y-3">
              <div class="space-y-1.5">
                <Label>Title</Label>
                <Input v-model="editForm.title" :disabled="isArxiv" />
              </div>
              <div class="space-y-1.5">
                <Label>Authors (comma-separated)</Label>
                <Input v-model="editForm.authors" :disabled="isArxiv" />
              </div>
              <div class="space-y-1.5">
                <Label>Source URL</Label>
                <Input v-model="editForm.link" placeholder="https://…" />
              </div>
              <div class="space-y-1.5">
                <Label>Content (user input)</Label>
                <Textarea v-model="editForm.content" rows="10" placeholder="Enter paper content…" class="font-mono resize-y" />
              </div>
              <div class="flex justify-end gap-2">
                <Button variant="outline" size="sm" @click="cancelEdit">
                  <X />Cancel
                </Button>
                <Button size="sm" :disabled="saving" @click="saveEdit">
                  <Save />{{ saving ? 'Saving…' : 'Save' }}
                </Button>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="flex items-start justify-between gap-3">
              <h2 :class="[isEmbed ? 'text-sm' : 'text-lg', 'font-semibold leading-snug']">{{ store.currentPaper.title }}</h2>
              <div v-if="!isEmbed" class="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon-sm" title="Edit" @click="enterEditMode">
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon-sm" title="Delete" class="hover:text-destructive" @click="showDeleteDialog = true; deleteConfirmId = ''">
                  <Trash2 />
                </Button>
              </div>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <SourceTag :link="store.currentPaper.link" :arxiv-id="store.currentPaper.arxiv_id" />
              <S2Badge :corpus-id="store.currentPaper.corpus_id" :s2-url="(store.currentPaper.metadata as any)?.s2_url" />
              <Badge variant="outline" class="gap-1">
                <Calendar />{{ new Date(store.currentPaper.created_at).toLocaleDateString() }}
              </Badge>
            </div>
            <div v-if="store.currentPaper.authors?.length" class="space-y-2">
              <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Users class="h-3 w-3" /> Authors
              </div>
              <div class="flex flex-wrap gap-1">
                <Badge v-for="a in (Array.isArray(store.currentPaper.authors) ? store.currentPaper.authors : [])" :key="a" variant="secondary">{{ a }}</Badge>
              </div>
            </div>
            <div class="space-y-2">
              <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Tag class="h-3 w-3" /> Tags
                <Button v-if="!isEditingTags" variant="ghost" size="icon-xs" class="ml-auto" @click="startEditTags">
                  <Pencil />
                </Button>
              </div>
              <template v-if="isEditingTags">
                <TagSelector v-model="editingTags" />
                <div class="flex gap-2">
                  <Button size="sm" :disabled="savingTags" @click="saveTags">
                    {{ savingTags ? 'Saving…' : 'Save' }}
                  </Button>
                  <Button variant="ghost" size="sm" @click="cancelEditTags">Cancel</Button>
                </div>
              </template>
              <template v-else>
                <div v-if="(store.currentPaper as any).tags?.length" class="flex flex-wrap gap-1">
                  <TagBadge v-for="t in (store.currentPaper as any).tags" :key="t.id || t" :tag-id="t.id || 0" :tag-name="t.name || t" clickable @click="navigateToTagFilter(t.id)" />
                </div>
                <Button v-else variant="link" size="xs" @click="startEditTags">+ Add tag</Button>
              </template>
            </div>
            <PaperFullTextCopy :paper-id="paperId" />
            <ReferenceLinksSection :paper-id="paperId" />
            <div v-if="store.currentPaper.abstract" class="space-y-2">
              <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Abstract</div>
              <BilingualText :text="store.currentPaper.abstract || ''" />
            </div>
            <div v-if="s2meta" class="space-y-2">
              <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Semantic Scholar</div>
              <div class="flex flex-wrap gap-1.5">
                <Badge v-if="s2meta.citationCount !== undefined" variant="secondary">{{ s2meta.citationCount }} {{ s2meta.citationCount === 1 ? 'citation' : 'citations' }}</Badge>
                <Badge v-if="s2meta.influentialCount !== undefined" variant="outline">influential {{ s2meta.influentialCount }}</Badge>
              </div>
              <p v-if="s2meta.tldr" class="text-sm text-muted-foreground leading-relaxed"><span class="font-medium text-foreground">TL;DR </span>{{ s2meta.tldr }}</p>
            </div>
          </template>
        </Card>

        <PaperCitations :paper-id="paperId" />

        <PaperNotesCard :paper-id="paperId" />

        <Card v-if="summaryFaqs" class="overflow-hidden gap-0 py-0">
          <div class="flex items-center justify-between border-b px-5 py-3">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-semibold">Kimi summary</h3>
              <a v-if="papersCoolUrl" :href="papersCoolUrl" target="_blank" rel="noopener noreferrer"
                class="inline-flex items-center gap-0.5 text-xs text-primary hover:underline">
                (papers.cool) <ExternalLink class="h-2.5 w-2.5" />
              </a>
            </div>
            <div class="flex items-center gap-1.5">
              <Button variant="ghost" size="icon-sm" title="Expand all" @click="setAllKimiOpen(true)">
                <ChevronsUpDown />
              </Button>
              <Button variant="ghost" size="icon-sm" title="Collapse all" @click="setAllKimiOpen(false)">
                <ChevronsDownUp />
              </Button>
            </div>
          </div>
          <div class="divide-y">
            <Collapsible
              v-for="(faq, i) in summaryFaqs" :key="i"
              :open="kimiOpenMap[i] || false"
              @update:open="(v: boolean) => kimiOpenMap[i] = v"
            >
              <CollapsibleTrigger class="flex w-full items-center gap-3 px-5 py-3 cursor-pointer hover:bg-muted/40 transition-colors text-left">
                <span class="text-xs font-semibold shrink-0 text-muted-foreground">Q{{ i + 1 }}</span>
                <div class="flex-1 min-w-0">
                  <span class="text-sm font-semibold">{{ faq.question }}</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent class="px-5 pb-4 pt-1">
                <MarkdownContent :content="faq.answer" :paper-id="paperId" class="text-sm" />
              </CollapsibleContent>
            </Collapsible>
          </div>
        </Card>

        <QAList :paper-id="paperId" />
      </div>
      <QAPanelNav v-if="store.currentPaper" :entries="qaNavEntries" :scroll-container="narrowScrollRef" :paper-id="paperId" />
    </div>

    <QAInput v-if="store.currentPaper && !conversation.visible.value" :paper-id="paperId" />

    <Dialog v-model:open="showDeleteDialog">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle class="text-destructive">Delete paper</DialogTitle>
          <DialogDescription>
            Delete the paper <span class="font-semibold">"{{ store.currentPaper?.title }}"</span>?
            This cannot be undone. All Q&A entries, answers, service runs, tag links, and highlights of this paper will be permanently deleted.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-1.5">
          <Label>Type the paper's internal ID <span class="font-mono font-semibold">{{ store.currentPaper?.id }}</span> to confirm:</Label>
          <Input v-model="deleteConfirmId" placeholder="Paper ID" class="font-mono" />
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="showDeleteDialog = false">Cancel</Button>
          <Button variant="destructive" :disabled="!deleteIdMatch || deleting" @click="confirmDelete">
            {{ deleting ? 'Deleting…' : 'Delete permanently' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
