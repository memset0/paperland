<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePapersStore } from '@/stores/papers'
import { useQAStore } from '@/stores/qa'
import { ArrowLeft, ExternalLink, Calendar, Users, Tag, ChevronsUpDown, ChevronsDownUp } from 'lucide-vue-next'
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
const paperId = computed(() => parseInt(route.params.id as string, 10))

// Responsive: only show split view on wide screens
const isWide = ref(window.innerWidth >= 900)
function onResize() { isWide.value = window.innerWidth >= 900 }

// Draggable split
const leftWidth = ref(45)
const dragging = ref(false)

function startDrag() { dragging.value = true }
function onDrag(e: MouseEvent) {
  if (!dragging.value) return
  const el = document.getElementById('split-container')
  if (!el) return
  const rect = el.getBoundingClientRect()
  leftWidth.value = Math.max(20, Math.min(80, ((e.clientX - rect.left) / rect.width) * 100))
}
function stopDrag() { dragging.value = false }

onMounted(async () => {
  window.addEventListener('resize', onResize)
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  await store.fetchPaper(paperId.value)
  highlightStore.loadForPathname(route.path)
  await qaStore.fetchTemplates()
  qaStore.switchPaper(paperId.value)
  await qaStore.fetchQA(paperId.value, true)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
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
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5 shrink-0">
      <button @click="router.push('/')" class="rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
        <ArrowLeft class="h-4 w-4" />
      </button>
      <div class="min-w-0 flex-1">
        <h1 class="text-sm font-semibold text-gray-900 truncate">{{ store.currentPaper?.title || '加载中...' }}</h1>
      </div>
    </div>

    <!-- Wide screen: split view -->
    <div v-if="isWide" id="split-container" class="flex flex-1 overflow-hidden" :class="{ 'select-none': dragging }">
      <!-- Left: Viewer panel + floating input overlay -->
      <div :style="{ width: leftWidth + '%' }" class="shrink-0 overflow-hidden relative">
        <PaperViewerPanel :pdf-path="store.currentPaper?.pdf_path || null" :arxiv-id="store.currentPaper?.arxiv_id || null" />
        <div v-if="store.currentPaper" class="absolute bottom-0 left-0 right-0 z-10">
          <QAInput :paper-id="paperId" :sticky="false" />
        </div>
      </div>

      <!-- Divider -->
      <div @mousedown.prevent="startDrag" class="w-1.5 shrink-0 cursor-col-resize bg-gray-200 hover:bg-indigo-400 active:bg-indigo-500 transition-colors relative group">
        <div class="absolute inset-y-0 -left-1 -right-1"></div>
      </div>

      <!-- Right: Info + QA + floating input -->
      <div ref="wideScrollRef" class="flex-1 overflow-y-auto relative">
        <div v-if="store.loading" class="flex items-center justify-center h-full">
          <div class="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-600"></div>
        </div>
        <div v-else-if="store.currentPaper" class="p-5 space-y-5 pb-40">
          <!-- Paper info -->
          <div class="rounded-xl border border-gray-200 bg-white p-5">
            <h2 class="text-lg font-semibold text-gray-900 leading-snug mb-3">{{ store.currentPaper.title }}</h2>
            <div class="flex flex-wrap gap-1.5 mb-4">
              <span v-if="store.currentPaper.arxiv_id" class="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/10">
                <ExternalLink class="h-3 w-3" /> arXiv: {{ store.currentPaper.arxiv_id }}
              </span>
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
            <div v-if="(store.currentPaper as any).tags?.length" class="mb-4">
              <div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider mb-2"><Tag class="h-3 w-3" /> 标签</div>
              <div class="flex flex-wrap gap-1">
                <span v-for="t in (store.currentPaper as any).tags" :key="t" class="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-600/10">{{ t }}</span>
              </div>
            </div>
            <div v-if="store.currentPaper.abstract">
              <div class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">摘要</div>
              <p class="text-sm text-gray-600 leading-relaxed">{{ store.currentPaper.abstract }}</p>
            </div>
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
      <div v-else-if="store.currentPaper" class="p-5 space-y-5 max-w-3xl mx-auto pb-40">
        <!-- Paper info -->
        <div class="rounded-xl border border-gray-200 bg-white p-5">
          <h2 class="text-lg font-semibold text-gray-900 leading-snug mb-3">{{ store.currentPaper.title }}</h2>
          <div class="flex flex-wrap gap-1.5 mb-4">
            <span v-if="store.currentPaper.arxiv_id" class="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/10">
              <ExternalLink class="h-3 w-3" /> arXiv: {{ store.currentPaper.arxiv_id }}
            </span>
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
          <div v-if="(store.currentPaper as any).tags?.length" class="mb-4">
            <div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider mb-2"><Tag class="h-3 w-3" /> 标签</div>
            <div class="flex flex-wrap gap-1">
              <span v-for="t in (store.currentPaper as any).tags" :key="t" class="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-600/10">{{ t }}</span>
            </div>
          </div>
          <div v-if="store.currentPaper.abstract">
            <div class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">摘要</div>
            <p class="text-sm text-gray-600 leading-relaxed">{{ store.currentPaper.abstract }}</p>
          </div>
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
  </div>
</template>
