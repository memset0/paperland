<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePapersStore } from '@/stores/papers'
import { useQAStore } from '@/stores/qa'
import { ArrowLeft, ExternalLink, Calendar, Users, Tag, ChevronsUpDown, ChevronsDownUp, PanelLeftClose, PanelLeftOpen, RefreshCw, Pencil, Trash2, X, Save } from 'lucide-vue-next'
import SourceTag from '@/components/SourceTag.vue'
import TagBadge from '@/components/TagBadge.vue'
import TagSelector from '@/components/TagSelector.vue'
import { useTagsStore } from '@/stores/tags'
import { api } from '@/api/client'
import { useEmbedMode } from '@/composables/useEmbedMode'
import PaperViewerPanel from '@/components/PaperViewerPanel.vue'
import QAList from '@/components/QAList.vue'
import QAInput from '@/components/QAInput.vue'
import QAPanelNav from '@/components/QAPanelNav.vue'
import MarkdownContent from '@/components/MarkdownContent.vue'
import { useHighlightStore } from '@/stores/highlights'

const route = useRoute()
const router = useRouter()
const store = usePapersStore()
const qaStore = useQAStore()
const highlightStore = useHighlightStore()
const tagsStore = useTagsStore()
const { isEmbed } = useEmbedMode()
const paperId = computed(() => parseInt(route.params.id as string, 10))

function reloadPage() { window.location.reload() }

// Responsive: only show split view on wide screens (never in embed mode)
const isWide = ref(window.innerWidth >= 900)
function onResize() { isWide.value = window.innerWidth >= 900 }
const showSplitView = computed(() => isWide.value && !isEmbed.value)

// Draggable split
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

onMounted(async () => {
  window.addEventListener('resize', onResize)
  tagsStore.ensureLoaded()
  await store.fetchPaper(paperId.value)
  highlightStore.loadForPathname(route.path)
  await qaStore.fetchTemplates()
  qaStore.switchPaper(paperId.value)
  await qaStore.fetchQA(paperId.value, true)
})

function navigateToTagFilter(tagId: number) {
  router.push({ path: '/', query: { tags: String(tagId) } })
}

// Tag editing
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

// Papers.cool Chinese summary — FAQ panels
const summaryFaqs = computed(() => {
  const meta = store.currentPaper?.metadata
  if (!meta || typeof meta !== 'object') return null
  const raw = (meta as Record<string, unknown>).papers_cool_summary
  if (typeof raw !== 'string' || raw.length === 0) return null

  // Split by Q\d+: pattern into individual FAQ items
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

function setAllKimiOpen(open: boolean) {
  const container = document.querySelector('[data-kimi-list]')
  if (!container) return
  container.querySelectorAll<HTMLDetailsElement>('details').forEach(el => { el.open = open })
}

// QA panel navigation
const wideScrollRef = ref<HTMLElement | null>(null)
const narrowScrollRef = ref<HTMLElement | null>(null)

const qaNavEntries = computed(() => {
  const entries: Array<{ key: string; title: string }> = []
  for (const entry of qaStore.qaData.free) {
    entries.push({ key: 'free-' + entry.entry_id, title: entry.prompt || '自由提问' })
  }
  for (const tmpl of qaStore.templates) {
    entries.push({ key: 'tmpl-' + tmpl.name, title: tmpl.prompt })
  }
  return entries
})

// Edit mode
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

// Delete
const showDeleteDialog = ref(false)
const deleteConfirmId = ref('')
const deleting = ref(false)

const deleteIdMatch = computed(() => {
  return deleteConfirmId.value === String(store.currentPaper?.id)
})

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
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <!-- Embed: compact header with title + refresh -->
    <div v-if="isEmbed" class="flex h-6 items-center gap-1 border-b border-gray-200 px-2 shrink-0">
      <div class="min-w-0 flex-1">
        <h1 class="text-[11px] font-medium text-gray-500 truncate">{{ store.currentPaper?.title || '' }}</h1>
      </div>
      <button @click="reloadPage" class="shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition" title="刷新页面">
        <RefreshCw class="h-3 w-3" />
      </button>
    </div>
    <!-- Normal header -->
    <div v-else class="flex h-12 items-center gap-3 border-b border-gray-200 bg-white px-4 shrink-0">
      <button @click="router.push('/')" class="rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
        <ArrowLeft class="h-4 w-4" />
      </button>
      <div class="min-w-0 flex-1">
        <h1 class="text-sm font-semibold text-gray-900 truncate">{{ store.currentPaper?.title || '加载中...' }}</h1>
      </div>
    </div>

    <!-- Wide screen: split view -->
    <div v-if="showSplitView" id="split-container" class="flex flex-1 overflow-hidden" :class="{ 'select-none': dragging }">
      <!-- Left: Viewer panel + floating input overlay -->
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

      <!-- Divider -->
      <div
        @pointerdown.prevent="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        class="shrink-0 relative flex items-center justify-center touch-none group"
        :class="[
          collapsed ? 'cursor-default' : 'cursor-col-resize',
          dragging ? 'bg-indigo-500' : 'bg-gray-300 hover:bg-indigo-400',
          'transition-colors'
        ]"
        :style="{ width: '2px' }"
      >
        <!-- Invisible hit area for easier grabbing -->
        <div class="absolute inset-y-0 -left-[5px] -right-[5px]"></div>
        <!-- Collapse/expand toggle button -->
        <button
          @pointerdown.stop
          @click.stop="toggleCollapse"
          class="absolute z-10 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-200 shadow text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:shadow-md transition-all opacity-0 group-hover:opacity-100"
        >
          <PanelLeftOpen v-if="collapsed" class="h-3.5 w-3.5" />
          <PanelLeftClose v-else class="h-3.5 w-3.5" />
        </button>
      </div>

      <!-- Right: Info + QA + floating input -->
      <div ref="wideScrollRef" class="flex-1 overflow-y-auto relative">
        <div v-if="store.loading" class="flex items-center justify-center h-full">
          <div class="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-600"></div>
        </div>
        <div v-else-if="store.currentPaper" class="p-5 space-y-5 pb-40">
          <!-- Paper info -->
          <div class="rounded-xl border border-gray-200 bg-white p-5">
            <!-- Edit mode -->
            <template v-if="editing">
              <div class="space-y-3">
                <div>
                  <label class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 block">标题</label>
                  <input v-model="editForm.title" :disabled="isArxiv" :class="['w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100', isArxiv ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : '']" />
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 block">作者 (逗号分隔)</label>
                  <input v-model="editForm.authors" :disabled="isArxiv" :class="['w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100', isArxiv ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : '']" />
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 block">来源链接</label>
                  <input v-model="editForm.link" placeholder="https://..." class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                </div>
                <div>
                  <label class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 block">内容 (User Input)</label>
                  <textarea v-model="editForm.content" rows="10" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-y font-mono" placeholder="输入论文内容..."></textarea>
                </div>
                <div class="flex justify-end gap-2 pt-1">
                  <button @click="cancelEdit" class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition">
                    <X class="h-3.5 w-3.5" /> 取消
                  </button>
                  <button @click="saveEdit" :disabled="saving" class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition">
                    <Save class="h-3.5 w-3.5" /> {{ saving ? '保存中...' : '保存' }}
                  </button>
                </div>
              </div>
            </template>
            <!-- View mode -->
            <template v-else>
              <div class="flex items-start justify-between gap-3 mb-3">
                <h2 class="text-lg font-semibold text-gray-900 leading-snug">{{ store.currentPaper.title }}</h2>
                <div class="flex items-center gap-1 shrink-0">
                  <button @click="enterEditMode" class="rounded-md p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition" title="编辑">
                    <Pencil class="h-3.5 w-3.5" />
                  </button>
                  <button @click="showDeleteDialog = true; deleteConfirmId = ''" class="rounded-md p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="删除">
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div class="flex flex-wrap gap-1.5 mb-4">
                <SourceTag :link="store.currentPaper.link" :arxiv-id="store.currentPaper.arxiv_id" />
                <span v-if="store.currentPaper.corpus_id" class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                  Corpus: {{ store.currentPaper.corpus_id }}
                </span>
                <span class="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-xs text-gray-500 ring-1 ring-inset ring-gray-200">
                  <Calendar class="h-3 w-3" /> {{ new Date(store.currentPaper.created_at).toLocaleDateString() }}
                </span>
              </div>
              <div v-if="store.currentPaper.authors?.length" class="mb-4">
                <div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider mb-2"><Users class="h-3 w-3" /> 作者</div>
                <div class="flex flex-wrap gap-1">
                  <span v-for="a in (Array.isArray(store.currentPaper.authors) ? store.currentPaper.authors : [])" :key="a" class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">{{ a }}</span>
                </div>
              </div>
              <div class="mb-4">
                <div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  <Tag class="h-3 w-3" /> 标签
                  <button v-if="!isEditingTags" @click="startEditTags" class="ml-auto rounded p-0.5 text-gray-300 hover:text-gray-500 transition"><Pencil class="h-3 w-3" /></button>
                </div>
                <template v-if="isEditingTags">
                  <TagSelector v-model="editingTags" />
                  <div class="flex gap-2 mt-2">
                    <button @click="saveTags" :disabled="savingTags" class="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition">
                      {{ savingTags ? '保存中...' : '保存' }}
                    </button>
                    <button @click="cancelEditTags" class="rounded-md px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 transition">取消</button>
                  </div>
                </template>
                <template v-else>
                  <div v-if="(store.currentPaper as any).tags?.length" class="flex flex-wrap gap-1">
                    <TagBadge v-for="t in (store.currentPaper as any).tags" :key="t.id || t" :tag-id="t.id || 0" :tag-name="t.name || t" clickable @click="navigateToTagFilter(t.id)" />
                  </div>
                  <button v-else @click="startEditTags" class="text-xs text-gray-400 hover:text-indigo-500 transition">+ 添加标签</button>
                </template>
              </div>
              <div v-if="store.currentPaper.abstract">
                <div class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">摘要</div>
                <p class="text-sm text-gray-600 leading-relaxed">{{ store.currentPaper.abstract }}</p>
              </div>
            </template>
          </div>
          <!-- Kimi summary from papers.cool -->
          <div v-if="summaryFaqs" class="rounded-xl border border-gray-200 bg-white">
            <div class="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-gray-900">Kimi 自动摘要</h3>
                <a v-if="papersCoolUrl" :href="papersCoolUrl" target="_blank" rel="noopener noreferrer"
                  class="inline-flex items-center gap-0.5 text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
                  (papers.cool) <ExternalLink class="h-2.5 w-2.5" />
                </a>
              </div>
              <div class="flex items-center gap-1.5">
                <button @click="setAllKimiOpen(true)" title="全部展开"
                  class="rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                  <ChevronsUpDown class="h-3.5 w-3.5" />
                </button>
                <button @click="setAllKimiOpen(false)" title="全部折叠"
                  class="rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                  <ChevronsDownUp class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div class="divide-y divide-gray-50" data-kimi-list>
              <details v-for="(faq, i) in summaryFaqs" :key="i" class="group">
                <summary class="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50/60 transition-colors list-none [&::-webkit-details-marker]:hidden">
                  <span class="text-xs text-indigo-500 font-semibold shrink-0">Q{{ i + 1 }}</span>
                  <div class="flex-1 min-w-0">
                    <span class="text-sm font-semibold text-gray-800">{{ faq.question }}</span>
                  </div>
                </summary>
                <div class="px-5 pb-4 pt-1">
                  <MarkdownContent :content="faq.answer" class="text-sm text-gray-600" />
                </div>
              </details>
            </div>
          </div>
          <QAList :paper-id="paperId" />
        </div>
        <QAPanelNav v-if="store.currentPaper" :entries="qaNavEntries" :scroll-container="wideScrollRef" :paper-id="paperId" />
      </div>
    </div>

    <!-- Narrow screen: single column -->
    <div v-else ref="narrowScrollRef" class="flex-1 overflow-y-auto relative">
      <div v-if="store.loading" class="flex items-center justify-center py-20">
        <div class="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-600"></div>
      </div>
      <div v-else-if="store.currentPaper" :class="isEmbed ? 'p-1.5 space-y-1.5' : 'p-5 space-y-5 max-w-3xl mx-auto pb-40'">
        <!-- Paper info -->
        <div :class="['rounded-xl border border-gray-200 bg-white', isEmbed ? 'p-3' : 'p-5']">
          <!-- Edit mode -->
          <template v-if="editing">
            <div class="space-y-3">
              <div>
                <label class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 block">标题</label>
                <input v-model="editForm.title" :disabled="isArxiv" :class="['w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100', isArxiv ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : '']" />
              </div>
              <div>
                <label class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 block">作者 (逗号分隔)</label>
                <input v-model="editForm.authors" :disabled="isArxiv" :class="['w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100', isArxiv ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : '']" />
              </div>
              <div>
                <label class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 block">来源链接</label>
                <input v-model="editForm.link" placeholder="https://..." class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
              </div>
              <div>
                <label class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 block">内容 (User Input)</label>
                <textarea v-model="editForm.content" rows="10" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-y font-mono" placeholder="输入论文内容..."></textarea>
              </div>
              <div class="flex justify-end gap-2 pt-1">
                <button @click="cancelEdit" class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition">
                  <X class="h-3.5 w-3.5" /> 取消
                </button>
                <button @click="saveEdit" :disabled="saving" class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition">
                  <Save class="h-3.5 w-3.5" /> {{ saving ? '保存中...' : '保存' }}
                </button>
              </div>
            </div>
          </template>
          <!-- View mode -->
          <template v-else>
            <div class="flex items-start justify-between gap-3 mb-3">
              <h2 :class="[isEmbed ? 'text-sm' : 'text-lg', 'font-semibold text-gray-900 leading-snug']">{{ store.currentPaper.title }}</h2>
              <div v-if="!isEmbed" class="flex items-center gap-1 shrink-0">
                <button @click="enterEditMode" class="rounded-md p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition" title="编辑">
                  <Pencil class="h-3.5 w-3.5" />
                </button>
                <button @click="showDeleteDialog = true; deleteConfirmId = ''" class="rounded-md p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="删除">
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div class="flex flex-wrap gap-1.5 mb-4">
              <SourceTag :link="store.currentPaper.link" :arxiv-id="store.currentPaper.arxiv_id" />
              <span v-if="store.currentPaper.corpus_id" class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                Corpus: {{ store.currentPaper.corpus_id }}
              </span>
              <span class="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-xs text-gray-500 ring-1 ring-inset ring-gray-200">
                <Calendar class="h-3 w-3" /> {{ new Date(store.currentPaper.created_at).toLocaleDateString() }}
              </span>
            </div>
            <div v-if="store.currentPaper.authors?.length" class="mb-4">
              <div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider mb-2"><Users class="h-3 w-3" /> 作者</div>
              <div class="flex flex-wrap gap-1">
                <span v-for="a in (Array.isArray(store.currentPaper.authors) ? store.currentPaper.authors : [])" :key="a" class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">{{ a }}</span>
              </div>
            </div>
            <div class="mb-4">
              <div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                <Tag class="h-3 w-3" /> 标签
                <button v-if="!isEditingTags" @click="startEditTags" class="ml-auto rounded p-0.5 text-gray-300 hover:text-gray-500 transition"><Pencil class="h-3 w-3" /></button>
              </div>
              <template v-if="isEditingTags">
                <TagSelector v-model="editingTags" />
                <div class="flex gap-2 mt-2">
                  <button @click="saveTags" :disabled="savingTags" class="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition">
                    {{ savingTags ? '保存中...' : '保存' }}
                  </button>
                  <button @click="cancelEditTags" class="rounded-md px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 transition">取消</button>
                </div>
              </template>
              <template v-else>
                <div v-if="(store.currentPaper as any).tags?.length" class="flex flex-wrap gap-1">
                  <TagBadge v-for="t in (store.currentPaper as any).tags" :key="t.id || t" :tag-id="t.id || 0" :tag-name="t.name || t" clickable @click="navigateToTagFilter(t.id)" />
                </div>
                <button v-else @click="startEditTags" class="text-xs text-gray-400 hover:text-indigo-500 transition">+ 添加标签</button>
              </template>
            </div>
            <div v-if="store.currentPaper.abstract">
              <div class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">摘要</div>
              <p class="text-sm text-gray-600 leading-relaxed">{{ store.currentPaper.abstract }}</p>
            </div>
          </template>
        </div>
        <!-- Kimi summary from papers.cool -->
        <div v-if="summaryFaqs" class="rounded-xl border border-gray-200 bg-white">
          <div class="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-semibold text-gray-900">Kimi 自动摘要</h3>
              <a v-if="papersCoolUrl" :href="papersCoolUrl" target="_blank" rel="noopener noreferrer"
                class="inline-flex items-center gap-0.5 text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
                (papers.cool) <ExternalLink class="h-2.5 w-2.5" />
              </a>
            </div>
            <div class="flex items-center gap-1.5">
              <button @click="setAllKimiOpen(true)" title="全部展开"
                class="rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                <ChevronsUpDown class="h-3.5 w-3.5" />
              </button>
              <button @click="setAllKimiOpen(false)" title="全部折叠"
                class="rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                <ChevronsDownUp class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div class="divide-y divide-gray-50" data-kimi-list>
            <details v-for="(faq, i) in summaryFaqs" :key="i" class="group">
              <summary class="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50/60 transition-colors list-none [&::-webkit-details-marker]:hidden">
                <span class="text-xs text-indigo-500 font-semibold shrink-0">Q{{ i + 1 }}</span>
                <div class="flex-1 min-w-0">
                  <span class="text-sm font-semibold text-gray-800">{{ faq.question }}</span>
                </div>
              </summary>
              <div class="px-5 pb-4 pt-1">
                <MarkdownContent :content="faq.answer" class="text-sm text-gray-600" />
              </div>
            </details>
          </div>
        </div>
        <QAList :paper-id="paperId" />
      </div>
      <QAPanelNav v-if="store.currentPaper" :entries="qaNavEntries" :scroll-container="narrowScrollRef" :paper-id="paperId" />
      <!-- Floating input (sticky at bottom of page) -->
      <QAInput v-if="store.currentPaper" :paper-id="paperId" />
    </div>
    <!-- Delete confirmation dialog -->
    <Teleport to="body">
      <div v-if="showDeleteDialog" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" @click="showDeleteDialog = false"></div>
        <div class="relative w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-red-600">删除论文</h2>
            <button @click="showDeleteDialog = false" class="text-gray-400 hover:text-gray-600"><X class="h-5 w-5" /></button>
          </div>
          <div class="space-y-3">
            <p class="text-sm text-gray-600">
              你确定要删除论文 <span class="font-semibold text-gray-900">"{{ store.currentPaper?.title }}"</span> 吗？
            </p>
            <div class="rounded-lg bg-red-50 border border-red-100 p-3">
              <p class="text-xs text-red-700">此操作不可撤销。该论文下的所有 Q&A 条目、回答结果、服务执行记录、标签关联和高亮标注都将被永久删除。</p>
            </div>
            <div>
              <label class="text-sm text-gray-600 block mb-1.5">请输入论文内部 ID <span class="font-mono font-semibold text-gray-900">{{ store.currentPaper?.id }}</span> 以确认删除：</label>
              <input v-model="deleteConfirmId" placeholder="输入论文 ID" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100" />
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-5">
            <button @click="showDeleteDialog = false" class="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">取消</button>
            <button @click="confirmDelete" :disabled="!deleteIdMatch || deleting" class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition">
              {{ deleting ? '删除中...' : '确认删除' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
