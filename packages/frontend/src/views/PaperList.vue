<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePapersStore } from '@/stores/papers'
import { Plus, Search, X, FileText, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-vue-next'

const store = usePapersStore()
const router = useRouter()
const search = ref('')
const showAdd = ref(false)
const addTab = ref<'arxiv' | 'corpus' | 'manual'>('arxiv')
const addForm = ref({ arxiv_id: '', corpus_id: '', title: '', authors: '', content: '', link: '' })
const adding = ref(false)

onMounted(() => store.fetchPapers())

const showSortMenu = ref(false)

function onSearch() { store.fetchPapers(1, search.value) }
function goToPage(p: number) { store.fetchPapers(p, search.value) }

function setSort(field: 'created_at' | 'updated_at') {
  store.sortBy = field
  store.sortOrder = 'desc'
  localStorage.setItem('paperland_sort_by', field)
  localStorage.setItem('paperland_sort_order', 'desc')
  showSortMenu.value = false
  store.fetchPapers(1, search.value)
}

function getSourceInfo(paper: any) {
  if (!paper.link) return null
  try {
    const url = new URL(paper.link)
    if (url.hostname.includes('arxiv.org') && paper.arxiv_id) {
      return { label: `arxiv:${paper.arxiv_id}`, color: 'red', url: paper.link }
    }
    return { label: url.hostname.replace(/^www\./, ''), color: 'gray', url: paper.link }
  } catch {
    return { label: paper.link, color: 'gray', url: paper.link }
  }
}

function formatAuthors(a: string[]) {
  if (!Array.isArray(a) || !a.length) return '-'
  return a.length <= 2 ? a.join(', ') : `${a[0]} et al.`
}

async function addPaper() {
  adding.value = true
  try {
    const data: any = {}
    if (addTab.value === 'arxiv') data.arxiv_id = addForm.value.arxiv_id
    else if (addTab.value === 'corpus') data.corpus_id = addForm.value.corpus_id
    else { data.title = addForm.value.title; data.authors = addForm.value.authors.split(',').map(s => s.trim()).filter(Boolean); data.content = addForm.value.content; if (addForm.value.link) data.link = addForm.value.link }
    const result = await store.createPaper(data)
    showAdd.value = false
    addForm.value = { arxiv_id: '', corpus_id: '', title: '', authors: '', content: '', link: '' }
    store.fetchPapers()
    if (result.id) router.push(`/papers/${result.id}`)
  } finally { adding.value = false }
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">论文管理</h1>
        <p class="text-sm text-gray-500 mt-0.5">管理你的学术论文库</p>
      </div>
      <button @click="showAdd = true" class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors">
        <Plus class="h-4 w-4" />添加论文
      </button>
    </div>

    <!-- Search + Sort -->
    <div class="flex gap-2 mb-4">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input v-model="search" @keyup.enter="onSearch" placeholder="搜索论文标题、摘要..." class="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm placeholder:text-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition" />
      </div>
      <div class="relative">
        <button @click="showSortMenu = !showSortMenu" class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition whitespace-nowrap">
          <ArrowUpDown class="h-4 w-4" />{{ store.sortBy === 'updated_at' ? '最近修改' : '添加时间' }}
        </button>
        <div v-if="showSortMenu" class="absolute right-0 top-full mt-1 z-10 w-32 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <button @click="setSort('created_at')" :class="['w-full px-3 py-1.5 text-left text-sm transition', store.sortBy === 'created_at' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50']">添加时间</button>
          <button @click="setSort('updated_at')" :class="['w-full px-3 py-1.5 text-left text-sm transition', store.sortBy === 'updated_at' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50']">最近修改</button>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 bg-gray-50/60">
            <th class="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider">标题</th>
            <th class="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider w-40">作者</th>
            <th class="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider w-32">来源</th>
            <th class="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider w-24">添加日期</th>
            <th class="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider w-24">最近修改</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="paper in store.papers" :key="paper.id" @click="router.push(`/papers/${paper.id}`)" class="hover:bg-indigo-50/40 cursor-pointer transition-colors">
            <td class="px-4 py-3">
              <div class="font-medium text-gray-900 line-clamp-1">{{ paper.title }}</div>
            </td>
            <td class="px-4 py-3 text-gray-500 truncate max-w-[10rem]">{{ formatAuthors(paper.authors) }}</td>
            <td class="px-4 py-3">
              <a v-if="getSourceInfo(paper)" :href="getSourceInfo(paper)!.url" target="_blank" rel="noopener" @click.stop :class="[
                'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset hover:opacity-80 transition-opacity',
                getSourceInfo(paper)!.color === 'red' ? 'bg-red-50 text-red-700 ring-red-600/10' : 'bg-gray-50 text-gray-600 ring-gray-500/10'
              ]">{{ getSourceInfo(paper)!.label }}</a>
              <span v-else class="text-gray-300">-</span>
            </td>
            <td class="px-4 py-3 text-gray-400 text-xs">{{ new Date(paper.created_at).toLocaleDateString() }}</td>
            <td class="px-4 py-3 text-gray-400 text-xs">{{ new Date(paper.updated_at).toLocaleDateString() }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="store.papers.length === 0 && !store.loading" class="flex flex-col items-center justify-center py-16 text-gray-400">
        <FileText class="h-10 w-10 mb-3 stroke-1" />
        <p class="text-sm">暂无论文</p>
      </div>
      <div v-if="store.loading" class="flex items-center justify-center py-12">
        <div class="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-600"></div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="store.pagination.total_pages > 1" class="flex items-center justify-center gap-2 mt-4">
      <button :disabled="store.pagination.page <= 1" @click="goToPage(store.pagination.page - 1)" class="rounded-md border border-gray-200 p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition">
        <ChevronLeft class="h-4 w-4" />
      </button>
      <span class="text-xs text-gray-500 tabular-nums">{{ store.pagination.page }} / {{ store.pagination.total_pages }}</span>
      <button :disabled="store.pagination.page >= store.pagination.total_pages" @click="goToPage(store.pagination.page + 1)" class="rounded-md border border-gray-200 p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition">
        <ChevronRight class="h-4 w-4" />
      </button>
    </div>

    <!-- Add Dialog -->
    <Teleport to="body">
      <div v-if="showAdd" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" @click="showAdd = false"></div>
        <div class="relative w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-lg font-semibold text-gray-900">添加论文</h2>
            <button @click="showAdd = false" class="text-gray-400 hover:text-gray-600"><X class="h-5 w-5" /></button>
          </div>
          <div class="flex gap-1 rounded-lg bg-gray-100 p-1 mb-5">
            <button v-for="t in (['arxiv', 'corpus', 'manual'] as const)" :key="t" @click="addTab = t" :class="['flex-1 rounded-md py-1.5 text-xs font-medium transition-all', addTab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700']">
              {{ t === 'arxiv' ? 'arXiv ID' : t === 'corpus' ? 'Corpus ID' : '手动输入' }}
            </button>
          </div>
          <div v-if="addTab === 'arxiv'">
            <input v-model="addForm.arxiv_id" placeholder="例: 1706.03762" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
          </div>
          <div v-else-if="addTab === 'corpus'">
            <input v-model="addForm.corpus_id" placeholder="例: 123456789" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
          </div>
          <div v-else class="space-y-3">
            <input v-model="addForm.title" placeholder="标题" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            <input v-model="addForm.authors" placeholder="作者 (逗号分隔)" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            <input v-model="addForm.link" placeholder="来源链接 (可选, 例: https://example.com/paper)" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            <textarea v-model="addForm.content" placeholder="论文内容..." rows="4" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none"></textarea>
          </div>
          <div class="flex justify-end gap-2 mt-5">
            <button @click="showAdd = false" class="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">取消</button>
            <button @click="addPaper" :disabled="adding" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition">
              {{ adding ? '添加中...' : '添加' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
