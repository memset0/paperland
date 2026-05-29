<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePapersStore } from '@/stores/papers'
import { useQAStore } from '@/stores/qa'
import { useBlockAnchor } from '@/composables/useBlockAnchor'
import { ArrowLeft, ExternalLink, Calendar, Users, Tag, ChevronsUpDown, ChevronsDownUp, PanelLeftClose, PanelLeftOpen, RefreshCw, Pencil, Trash2, X, Save, Loader2 } from '@lucide/vue'
import SourceTag from '@/components/SourceTag.vue'
import S2Badge from '@/components/S2Badge.vue'
import TagBadge from '@/components/TagBadge.vue'
import TagSelector from '@/components/TagSelector.vue'
import { useTagsStore } from '@/stores/tags'
import { api } from '@/api/client'
import { useEmbedMode } from '@/composables/useEmbedMode'
import { usePageTitle } from '@/composables/usePageTitle'
import PaperViewerPanel from '@/components/PaperViewerPanel.vue'
import QAList from '@/components/QAList.vue'
import PaperNotesCard from '@/components/PaperNotesCard.vue'
import PaperCitations from '@/components/PaperCitations.vue'
import QAInput from '@/components/QAInput.vue'
import QAPanelNav from '@/components/QAPanelNav.vue'
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
const highlightStore = useHighlightStore()
const tagsStore = useTagsStore()
const { isEmbed } = useEmbedMode()
const { locateBlock } = useBlockAnchor()
const paperId = computed(() => parseInt(route.params.id as string, 10))

// Browser tab title follows the paper; shows a placeholder until it loads.
usePageTitle(() => store.currentPaper?.title ?? '论文详情')

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

const leftWidth = ref(45)
const dragging = ref(false)
const collapsed = ref(false)
const savedWidth = ref(45)

function onPointerDown(e: PointerEvent) {
  if (collapsed.value) return
  dragging.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  const el = document.getElementById('split-container')
  if (!el) return
  const rect = el.getBoundingClientRect()
  leftWidth.value = Math.max(20, Math.min(80, ((e.clientX - rect.left) / rect.width) * 100))
}
function onPointerUp(e: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
}

function toggleCollapse() {
  if (collapsed.value) {
    collapsed.value = false
    leftWidth.value = savedWidth.value
  } else {
    savedWidth.value = leftWidth.value
    collapsed.value = true
    leftWidth.value = 0
  }
}

/** Jump to a `?h=<hash>` deep-link target once the paper + Q&A data are present. */
function handleAnchorFromRoute() {
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
watch(() => [route.params.id, route.query.h, route.query.s, route.query.e], async (next, prev) => {
  if (next[0] !== prev[0]) await loadPaperData()
  await nextTick()
  handleAnchorFromRoute()
})

function navigateToTagFilter(tagId: number) {
  router.push({ path: '/', query: { tags: String(tagId) } })
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

const wideScrollRef = ref<HTMLElement | null>(null)
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
    entries.push({ key: 'free-' + entry.entry_id, title: entry.prompt || '自由提问' })
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
    router.push('/')
  } finally {
    deleting.value = false
  }
}

const promoting = ref(false)
async function promote() {
  if (!store.currentPaper) return
  promoting.value = true
  try {
    await store.promote(store.currentPaper.id)
  } finally {
    promoting.value = false
  }
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Embed: compact header -->
    <div v-if="isEmbed" class="flex h-6 items-center gap-1 border-b px-2 shrink-0">
      <div class="min-w-0 flex-1">
        <h1 class="text-[11px] font-medium text-muted-foreground truncate">{{ store.currentPaper?.title || '' }}</h1>
      </div>
      <Button variant="ghost" size="icon-xs" title="刷新页面" @click="reloadPage">
        <RefreshCw />
      </Button>
    </div>
    <!-- Normal header -->
    <div v-else class="flex h-12 items-center gap-3 border-b bg-background px-4 shrink-0">
      <Button variant="ghost" size="icon-sm" @click="router.push('/')">
        <ArrowLeft />
      </Button>
      <div class="min-w-0 flex-1">
        <h1 class="text-sm font-semibold truncate">{{ store.currentPaper?.title || '加载中...' }}</h1>
      </div>
    </div>

    <!-- Wide screen: split view -->
    <div v-if="showSplitView" id="split-container" class="flex flex-1 overflow-hidden" :class="{ 'select-none': dragging }">
      <div
        :style="{ width: collapsed ? '0%' : leftWidth + '%' }"
        class="shrink-0 overflow-hidden relative"
        :class="{ 'transition-[width] duration-300 ease-in-out': !dragging }"
      >
        <PaperViewerPanel :pdf-path="store.currentPaper?.pdf_path || null" :arxiv-id="store.currentPaper?.arxiv_id || null" />
        <div v-if="store.currentPaper" class="absolute bottom-0 left-0 right-0 z-10">
          <QAInput :paper-id="paperId" :sticky="false" />
        </div>
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

      <div ref="wideScrollRef" class="flex-1 overflow-y-auto relative">
        <div v-if="store.loading" class="flex items-center justify-center h-full">
          <Loader2 class="h-5 w-5 animate-spin text-primary" />
        </div>
        <div v-else-if="store.currentPaper" class="p-5 space-y-5 pb-40">
          <Card class="p-5">
            <template v-if="editing">
              <div class="space-y-3">
                <div class="space-y-1.5">
                  <Label>标题</Label>
                  <Input v-model="editForm.title" :disabled="isArxiv" />
                </div>
                <div class="space-y-1.5">
                  <Label>作者 (逗号分隔)</Label>
                  <Input v-model="editForm.authors" :disabled="isArxiv" />
                </div>
                <div class="space-y-1.5">
                  <Label>来源链接</Label>
                  <Input v-model="editForm.link" placeholder="https://..." />
                </div>
                <div class="space-y-1.5">
                  <Label>内容 (User Input)</Label>
                  <Textarea v-model="editForm.content" rows="10" placeholder="输入论文内容..." class="font-mono resize-y" />
                </div>
                <div class="flex justify-end gap-2">
                  <Button variant="outline" size="sm" @click="cancelEdit">
                    <X />取消
                  </Button>
                  <Button size="sm" :disabled="saving" @click="saveEdit">
                    <Save />{{ saving ? '保存中...' : '保存' }}
                  </Button>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="flex items-start justify-between gap-3">
                <h2 class="text-lg font-semibold leading-snug">{{ store.currentPaper.title }}</h2>
                <div class="flex items-center gap-1 shrink-0">
                  <Button v-if="store.currentPaper.listed === false" size="sm" :disabled="promoting" @click="promote">
                    {{ promoting ? '加入中…' : '加入列表' }}
                  </Button>
                  <Button variant="ghost" size="icon-sm" title="编辑" @click="enterEditMode">
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon-sm" title="删除" class="hover:text-destructive" @click="showDeleteDialog = true; deleteConfirmId = ''">
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <SourceTag :link="store.currentPaper.link" :arxiv-id="store.currentPaper.arxiv_id" />
                <S2Badge :corpus-id="store.currentPaper.corpus_id" :s2-url="(store.currentPaper.metadata as any)?.s2_url" />
                <a v-for="(o, i) in ((store.currentPaper as any).openreview_links || [])" :key="'or' + i" :href="o.link" target="_blank" rel="noopener" class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground">OpenReview<span v-if="((store.currentPaper as any).openreview_links || []).length > 1" class="ml-0.5">{{ i + 1 }}</span></a>
                <Badge variant="outline" class="gap-1">
                  <Calendar />{{ new Date(store.currentPaper.created_at).toLocaleDateString() }}
                </Badge>
              </div>
              <div v-if="store.currentPaper.authors?.length" class="space-y-2">
                <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <Users class="h-3 w-3" /> 作者
                </div>
                <div class="flex flex-wrap gap-1">
                  <Badge v-for="a in (Array.isArray(store.currentPaper.authors) ? store.currentPaper.authors : [])" :key="a" variant="secondary">{{ a }}</Badge>
                </div>
              </div>
              <div class="space-y-2">
                <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <Tag class="h-3 w-3" /> 标签
                  <Button v-if="!isEditingTags" variant="ghost" size="icon-xs" class="ml-auto" @click="startEditTags">
                    <Pencil />
                  </Button>
                </div>
                <template v-if="isEditingTags">
                  <TagSelector v-model="editingTags" />
                  <div class="flex gap-2">
                    <Button size="sm" :disabled="savingTags" @click="saveTags">
                      {{ savingTags ? '保存中...' : '保存' }}
                    </Button>
                    <Button variant="ghost" size="sm" @click="cancelEditTags">取消</Button>
                  </div>
                </template>
                <template v-else>
                  <div v-if="(store.currentPaper as any).tags?.length" class="flex flex-wrap gap-1">
                    <TagBadge v-for="t in (store.currentPaper as any).tags" :key="t.id || t" :tag-id="t.id || 0" :tag-name="t.name || t" clickable @click="navigateToTagFilter(t.id)" />
                  </div>
                  <Button v-else variant="link" size="xs" @click="startEditTags">+ 添加标签</Button>
                </template>
              </div>
              <div v-if="store.currentPaper.abstract" class="space-y-2">
                <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">摘要</div>
                <p class="text-sm text-muted-foreground leading-relaxed">{{ store.currentPaper.abstract }}</p>
              </div>
              <div v-if="s2meta" class="space-y-2">
                <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Semantic Scholar</div>
                <div class="flex flex-wrap gap-1.5">
                  <Badge v-if="s2meta.citationCount !== undefined" variant="secondary">引用 {{ s2meta.citationCount }}</Badge>
                  <Badge v-if="s2meta.influentialCount !== undefined" variant="outline">influential {{ s2meta.influentialCount }}</Badge>
                </div>
                <p v-if="s2meta.tldr" class="text-sm text-muted-foreground leading-relaxed"><span class="font-medium text-foreground">TL;DR </span>{{ s2meta.tldr }}</p>
              </div>
            </template>
          </Card>

          <Card v-if="summaryFaqs" class="overflow-hidden gap-0 py-0">
            <div class="flex items-center justify-between border-b px-5 py-3">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold">Kimi 自动摘要</h3>
                <a v-if="papersCoolUrl" :href="papersCoolUrl" target="_blank" rel="noopener noreferrer"
                  class="inline-flex items-center gap-0.5 text-xs text-primary hover:underline">
                  (papers.cool) <ExternalLink class="h-2.5 w-2.5" />
                </a>
              </div>
              <div class="flex items-center gap-1.5">
                <Button variant="ghost" size="icon-sm" title="全部展开" @click="setAllKimiOpen(true)">
                  <ChevronsUpDown />
                </Button>
                <Button variant="ghost" size="icon-sm" title="全部折叠" @click="setAllKimiOpen(false)">
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

          <PaperCitations :paper-id="paperId" />

          <PaperNotesCard :paper-id="paperId" />

          <QAList :paper-id="paperId" />
        </div>
        <QAPanelNav v-if="store.currentPaper" :entries="qaNavEntries" :scroll-container="wideScrollRef" :paper-id="paperId" />
      </div>
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
                <Label>标题</Label>
                <Input v-model="editForm.title" :disabled="isArxiv" />
              </div>
              <div class="space-y-1.5">
                <Label>作者 (逗号分隔)</Label>
                <Input v-model="editForm.authors" :disabled="isArxiv" />
              </div>
              <div class="space-y-1.5">
                <Label>来源链接</Label>
                <Input v-model="editForm.link" placeholder="https://..." />
              </div>
              <div class="space-y-1.5">
                <Label>内容 (User Input)</Label>
                <Textarea v-model="editForm.content" rows="10" placeholder="输入论文内容..." class="font-mono resize-y" />
              </div>
              <div class="flex justify-end gap-2">
                <Button variant="outline" size="sm" @click="cancelEdit">
                  <X />取消
                </Button>
                <Button size="sm" :disabled="saving" @click="saveEdit">
                  <Save />{{ saving ? '保存中...' : '保存' }}
                </Button>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="flex items-start justify-between gap-3">
              <h2 :class="[isEmbed ? 'text-sm' : 'text-lg', 'font-semibold leading-snug']">{{ store.currentPaper.title }}</h2>
              <div v-if="!isEmbed" class="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon-sm" title="编辑" @click="enterEditMode">
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon-sm" title="删除" class="hover:text-destructive" @click="showDeleteDialog = true; deleteConfirmId = ''">
                  <Trash2 />
                </Button>
              </div>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <SourceTag :link="store.currentPaper.link" :arxiv-id="store.currentPaper.arxiv_id" />
              <S2Badge :corpus-id="store.currentPaper.corpus_id" :s2-url="(store.currentPaper.metadata as any)?.s2_url" />
                <a v-for="(o, i) in ((store.currentPaper as any).openreview_links || [])" :key="'or' + i" :href="o.link" target="_blank" rel="noopener" class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground">OpenReview<span v-if="((store.currentPaper as any).openreview_links || []).length > 1" class="ml-0.5">{{ i + 1 }}</span></a>
              <Badge variant="outline" class="gap-1">
                <Calendar />{{ new Date(store.currentPaper.created_at).toLocaleDateString() }}
              </Badge>
            </div>
            <div v-if="store.currentPaper.authors?.length" class="space-y-2">
              <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Users class="h-3 w-3" /> 作者
              </div>
              <div class="flex flex-wrap gap-1">
                <Badge v-for="a in (Array.isArray(store.currentPaper.authors) ? store.currentPaper.authors : [])" :key="a" variant="secondary">{{ a }}</Badge>
              </div>
            </div>
            <div class="space-y-2">
              <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Tag class="h-3 w-3" /> 标签
                <Button v-if="!isEditingTags" variant="ghost" size="icon-xs" class="ml-auto" @click="startEditTags">
                  <Pencil />
                </Button>
              </div>
              <template v-if="isEditingTags">
                <TagSelector v-model="editingTags" />
                <div class="flex gap-2">
                  <Button size="sm" :disabled="savingTags" @click="saveTags">
                    {{ savingTags ? '保存中...' : '保存' }}
                  </Button>
                  <Button variant="ghost" size="sm" @click="cancelEditTags">取消</Button>
                </div>
              </template>
              <template v-else>
                <div v-if="(store.currentPaper as any).tags?.length" class="flex flex-wrap gap-1">
                  <TagBadge v-for="t in (store.currentPaper as any).tags" :key="t.id || t" :tag-id="t.id || 0" :tag-name="t.name || t" clickable @click="navigateToTagFilter(t.id)" />
                </div>
                <Button v-else variant="link" size="xs" @click="startEditTags">+ 添加标签</Button>
              </template>
            </div>
            <div v-if="store.currentPaper.abstract" class="space-y-2">
              <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">摘要</div>
              <p class="text-sm text-muted-foreground leading-relaxed">{{ store.currentPaper.abstract }}</p>
            </div>
            <div v-if="s2meta" class="space-y-2">
              <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Semantic Scholar</div>
              <div class="flex flex-wrap gap-1.5">
                <Badge v-if="s2meta.citationCount !== undefined" variant="secondary">引用 {{ s2meta.citationCount }}</Badge>
                <Badge v-if="s2meta.influentialCount !== undefined" variant="outline">influential {{ s2meta.influentialCount }}</Badge>
              </div>
              <p v-if="s2meta.tldr" class="text-sm text-muted-foreground leading-relaxed"><span class="font-medium text-foreground">TL;DR </span>{{ s2meta.tldr }}</p>
            </div>
          </template>
        </Card>

        <Card v-if="summaryFaqs" class="overflow-hidden gap-0 py-0">
          <div class="flex items-center justify-between border-b px-5 py-3">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-semibold">Kimi 自动摘要</h3>
              <a v-if="papersCoolUrl" :href="papersCoolUrl" target="_blank" rel="noopener noreferrer"
                class="inline-flex items-center gap-0.5 text-xs text-primary hover:underline">
                (papers.cool) <ExternalLink class="h-2.5 w-2.5" />
              </a>
            </div>
            <div class="flex items-center gap-1.5">
              <Button variant="ghost" size="icon-sm" title="全部展开" @click="setAllKimiOpen(true)">
                <ChevronsUpDown />
              </Button>
              <Button variant="ghost" size="icon-sm" title="全部折叠" @click="setAllKimiOpen(false)">
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

        <PaperCitations :paper-id="paperId" />

        <PaperNotesCard :paper-id="paperId" />

        <QAList :paper-id="paperId" />
      </div>
      <QAPanelNav v-if="store.currentPaper" :entries="qaNavEntries" :scroll-container="narrowScrollRef" :paper-id="paperId" />
      <QAInput v-if="store.currentPaper" :paper-id="paperId" />
    </div>

    <Dialog v-model:open="showDeleteDialog">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle class="text-destructive">删除论文</DialogTitle>
          <DialogDescription>
            你确定要删除论文 <span class="font-semibold">"{{ store.currentPaper?.title }}"</span> 吗？
            此操作不可撤销。该论文下的所有 Q&A 条目、回答结果、服务执行记录、标签关联和高亮标注都将被永久删除。
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-1.5">
          <Label>请输入论文内部 ID <span class="font-mono font-semibold">{{ store.currentPaper?.id }}</span> 以确认删除：</Label>
          <Input v-model="deleteConfirmId" placeholder="输入论文 ID" class="font-mono" />
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="showDeleteDialog = false">取消</Button>
          <Button variant="destructive" :disabled="!deleteIdMatch || deleting" @click="confirmDelete">
            {{ deleting ? '删除中...' : '确认删除' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
