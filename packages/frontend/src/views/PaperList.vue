<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePapersStore } from '@/stores/papers'
import { useTagsStore } from '@/stores/tags'
import { useAuthStore } from '@/stores/auth'
import { useLoginPrompt } from '@/composables/useLoginPrompt'
import { Plus, Search, FileText, ChevronLeft, ChevronRight, ArrowUpDown, Tag, Loader2 } from '@lucide/vue'
import SourceTag from '@/components/SourceTag.vue'
import S2Badge from '@/components/S2Badge.vue'
import CountCell from '@/components/CountCell.vue'
import TagBadge from '@/components/TagBadge.vue'
import TagSelector from '@/components/TagSelector.vue'
import AppPage from '@/components/AppPage.vue'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'

const store = usePapersStore()
const tagsStore = useTagsStore()
const auth = useAuthStore()
const { openLogin } = useLoginPrompt()
const router = useRouter()

function onAddClick() {
  if (auth.isAuthenticated) showAdd.value = true
  else openLogin()
}
const route = useRoute()
const search = ref('')
const showAdd = ref(false)
const addTab = ref<'arxiv' | 'corpus' | 'manual'>('arxiv')
const addForm = ref({ arxiv_id: '', corpus_id: '', title: '', authors: '', content: '', link: '', tags: [] as string[] })
const adding = ref(false)

const selectedTagIds = ref<number[]>([])
const showTagFilter = ref(false)

onMounted(() => {
  const tagsParam = route.query.tags as string
  if (tagsParam) {
    selectedTagIds.value = tagsParam.split(',').map(Number).filter(n => !isNaN(n))
  }
  tagsStore.ensureLoaded()
  fetchWithFilters()
})

function fetchWithFilters(page = 1) {
  store.fetchPapers(page, search.value, selectedTagIds.value.length > 0 ? selectedTagIds.value : undefined)
}

function onSearch() { fetchWithFilters(1) }
function goToPage(p: number) { fetchWithFilters(p) }

const promotingId = ref<number | null>(null)
function setListedMode(mode: 'listed' | 'unlisted' | 'all') {
  store.listedMode = mode
  fetchWithFilters(1)
}
function onRowClick(paper: any) {
  // Metadata-only papers are not navigable until fetched (promoted)
  if (paper.listed) router.push(`/papers/${paper.id}`)
}
async function promote(paper: any) {
  if (paper.listable === false) return
  promotingId.value = paper.id
  try {
    await store.promote(paper.id)
    fetchWithFilters(store.pagination.page)
  } catch {
    // Backend rejected (e.g. 422 LISTING_NOT_ALLOWED) — the error toast is already shown
    // by the API client and local state is left unchanged.
  } finally {
    promotingId.value = null
  }
}

function toggleTagFilter(tagId: number) {
  const idx = selectedTagIds.value.indexOf(tagId)
  if (idx >= 0) {
    selectedTagIds.value.splice(idx, 1)
  } else {
    selectedTagIds.value.push(tagId)
  }
  const query = { ...route.query }
  if (selectedTagIds.value.length > 0) {
    query.tags = selectedTagIds.value.join(',')
  } else {
    delete query.tags
  }
  router.replace({ query })
  fetchWithFilters(1)
}

function clearTagFilter() {
  selectedTagIds.value = []
  const query = { ...route.query }
  delete query.tags
  router.replace({ query })
  fetchWithFilters(1)
}

function setSort(field: 'created_at' | 'updated_at') {
  store.sortBy = field
  store.sortOrder = 'desc'
  localStorage.setItem('paperland_sort_by', field)
  localStorage.setItem('paperland_sort_order', 'desc')
  fetchWithFilters(1)
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
    else {
      data.title = addForm.value.title
      data.authors = addForm.value.authors.split(',').map(s => s.trim()).filter(Boolean)
      data.content = addForm.value.content
      if (addForm.value.link) data.link = addForm.value.link
      if (addForm.value.tags.length > 0) data.tags = addForm.value.tags
    }
    const result = await store.createPaper(data)
    showAdd.value = false
    addForm.value = { arxiv_id: '', corpus_id: '', title: '', authors: '', content: '', link: '', tags: [] }
    tagsStore.refreshCache()
    store.fetchPapers()
    if (result.id) router.push(`/papers/${result.id}`)
  } finally { adding.value = false }
}
</script>

<template>
  <AppPage full>
    <template #actions>
      <Button @click="onAddClick">
        <Plus />添加论文
      </Button>
    </template>
    <div class="space-y-4">
    <div class="flex flex-wrap gap-2">
      <div class="relative w-full md:w-auto md:flex-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <Input v-model="search" @keyup.enter="onSearch" placeholder="搜索论文标题、摘要..." class="pl-9" />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline">
            <ArrowUpDown />{{ store.sortBy === 'updated_at' ? '最近修改' : '添加时间' }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @click="setSort('created_at')">添加时间</DropdownMenuItem>
          <DropdownMenuItem @click="setSort('updated_at')">最近修改</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline">
            {{ store.listedMode === 'all' ? '全部' : store.listedMode === 'unlisted' ? '仅元数据' : '已列出' }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @click="setListedMode('listed')">已列出</DropdownMenuItem>
          <DropdownMenuItem @click="setListedMode('unlisted')">仅元数据（待添加）</DropdownMenuItem>
          <DropdownMenuItem @click="setListedMode('all')">全部</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline" size="sm"
          @click="showTagFilter = !showTagFilter"
        >
          <Tag />标签筛选
          <Badge v-if="selectedTagIds.length" variant="secondary">{{ selectedTagIds.length }}</Badge>
        </Button>
        <Button v-if="selectedTagIds.length > 0" variant="link" size="xs" @click="clearTagFilter">清除筛选</Button>
      </div>
      <div v-if="showTagFilter" class="mt-2 flex flex-wrap gap-1.5">
        <Badge
          v-for="tag in tagsStore.tags.filter(t => t.visible)" :key="tag.id"
          as="button"
          :variant="selectedTagIds.includes(tag.id) ? 'default' : 'outline'"
          class="cursor-pointer"
          @click="toggleTagFilter(tag.id)"
        >
          {{ tag.name }}
          <span class="opacity-60 ml-1">{{ tag.paper_count }}</span>
        </Badge>
      </div>
    </div>

    <Card class="overflow-hidden gap-0 py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>标题</TableHead>
            <TableHead class="w-40 hidden md:table-cell">作者</TableHead>
            <TableHead class="w-32">来源</TableHead>
            <TableHead class="w-16 hidden md:table-cell">Cited</TableHead>
            <TableHead class="w-16 hidden md:table-cell">Refs</TableHead>
            <TableHead class="w-24 hidden md:table-cell">添加日期</TableHead>
            <TableHead class="w-24 hidden md:table-cell">最近修改</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="paper in store.papers" :key="paper.id"
            :class="paper.listed ? 'cursor-pointer' : 'opacity-70'"
            @click="onRowClick(paper)"
          >
            <TableCell>
              <div class="flex items-center gap-2">
                <div class="font-medium line-clamp-1">{{ paper.title }}</div>
                <Badge v-if="!paper.listed" variant="outline" class="shrink-0">仅元数据</Badge>
                <Button
                  v-if="!paper.listed"
                  size="xs" variant="secondary" class="shrink-0"
                  :disabled="promotingId === paper.id || (paper as any).listable === false"
                  :title="(paper as any).listable === false ? '仅有 OpenReview 链接，缺少 arXiv / Semantic Scholar 来源，无法加入列表' : undefined"
                  @click.stop="promote(paper)"
                >
                  {{ promotingId === paper.id ? '抓取中…' : '抓取' }}
                </Button>
              </div>
              <div v-if="(paper as any).tags?.filter((t: any) => tagsStore.tags.find(st => st.id === t.id)?.visible !== false).length" class="flex flex-wrap gap-1 mt-1">
                <TagBadge v-for="t in (paper as any).tags.filter((t: any) => tagsStore.tags.find(st => st.id === t.id)?.visible !== false)" :key="t.id" :tag-id="t.id" :tag-name="t.name" />
              </div>
            </TableCell>
            <TableCell class="text-muted-foreground truncate max-w-[10rem] hidden md:table-cell">{{ formatAuthors(paper.authors) }}</TableCell>
            <TableCell>
              <div class="flex items-center gap-1 whitespace-nowrap">
                <SourceTag :link="paper.link" :arxiv-id="paper.arxiv_id" />
                <S2Badge :corpus-id="paper.corpus_id" :s2-url="(paper as any).metadata?.s2_url" />
              </div>
            </TableCell>
            <TableCell class="hidden md:table-cell">
              <CountCell :value="(paper as any).metadata?.citation_count" title="Number of papers that cite this paper" />
            </TableCell>
            <TableCell class="hidden md:table-cell">
              <CountCell :value="(paper as any).metadata?.reference_count ?? (paper as any).metadata?.references?.length" title="Number of papers this paper cites" />
            </TableCell>
            <TableCell class="text-muted-foreground text-xs hidden md:table-cell">{{ new Date(paper.created_at).toLocaleDateString() }}</TableCell>
            <TableCell class="text-muted-foreground text-xs hidden md:table-cell">{{ new Date(paper.updated_at).toLocaleDateString() }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <div v-if="store.papers.length === 0 && !store.loading" class="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <FileText class="h-10 w-10 mb-3 stroke-1" />
        <p class="text-sm">暂无论文</p>
      </div>
      <div v-if="store.loading" class="flex items-center justify-center py-12">
        <Loader2 class="h-5 w-5 animate-spin text-primary" />
      </div>
    </Card>

    <div v-if="store.pagination.total_pages > 1" class="flex items-center justify-center gap-2">
      <Button variant="outline" size="icon-sm" :disabled="store.pagination.page <= 1" @click="goToPage(store.pagination.page - 1)">
        <ChevronLeft />
      </Button>
      <span class="text-xs text-muted-foreground tabular-nums">{{ store.pagination.page }} / {{ store.pagination.total_pages }}</span>
      <Button variant="outline" size="icon-sm" :disabled="store.pagination.page >= store.pagination.total_pages" @click="goToPage(store.pagination.page + 1)">
        <ChevronRight />
      </Button>
    </div>

    <Dialog v-model:open="showAdd">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>添加论文</DialogTitle>
        </DialogHeader>
        <Tabs v-model="addTab">
          <TabsList class="grid grid-cols-3 w-full">
            <TabsTrigger value="arxiv">arXiv ID</TabsTrigger>
            <TabsTrigger value="corpus">Corpus ID</TabsTrigger>
            <TabsTrigger value="manual">手动输入</TabsTrigger>
          </TabsList>
          <TabsContent value="arxiv">
            <Input v-model="addForm.arxiv_id" placeholder="例: 1706.03762" />
          </TabsContent>
          <TabsContent value="corpus">
            <Input v-model="addForm.corpus_id" placeholder="例: 123456789" />
          </TabsContent>
          <TabsContent value="manual" class="space-y-3">
            <Input v-model="addForm.title" placeholder="标题" />
            <Input v-model="addForm.authors" placeholder="作者 (逗号分隔)" />
            <Input v-model="addForm.link" placeholder="来源链接 (可选)" />
            <Textarea v-model="addForm.content" placeholder="论文内容..." rows="4" />
            <TagSelector v-model="addForm.tags" />
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="ghost" @click="showAdd = false">取消</Button>
          <Button :disabled="adding" @click="addPaper">
            {{ adding ? '添加中...' : '添加' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  </AppPage>
</template>
