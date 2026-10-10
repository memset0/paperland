<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePapersStore } from '@/stores/papers'
import { useTagsStore } from '@/stores/tags'
import { useAuthStore } from '@/stores/auth'
import { useLoginPrompt } from '@/composables/useLoginPrompt'
import { Plus, Search, FileText, ChevronLeft, ChevronRight, ArrowUpDown, Tag, Loader2, Circle, CircleCheck, CircleDashed } from '@lucide/vue'
import { notesApi } from '@/api/client'
import { parseS2Input } from '@/lib/s2-input'
import SourceTag from '@/components/SourceTag.vue'
import S2Badge from '@/components/S2Badge.vue'
import CountCell from '@/components/CountCell.vue'
import TagBadge from '@/components/TagBadge.vue'
import TagSelector from '@/components/TagSelector.vue'
import AppPage from '@/components/AppPage.vue'
import ScopeToggle from '@/components/ScopeToggle.vue'
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
const addForm = ref({ arxiv_id: '', s2_input: '', title: '', authors: '', content: '', link: '', tags: [] as string[] })
// Semantic Scholar tab: Corpus ID / S2 paper id / semanticscholar.org URL → routed field.
const s2Parsed = computed(() => parseS2Input(addForm.value.s2_input))
const s2Invalid = computed(() => addTab.value === 'corpus' && addForm.value.s2_input.trim() !== '' && !s2Parsed.value)
const adding = ref(false)

const selectedTagIds = ref<number[]>([])
const showTagFilter = ref(false)

// Per-paper note status for the current user (presence = a non-empty note; value = completed).
const noteDone = ref<Record<number, boolean>>({})
async function loadNoteStatuses() {
  if (!auth.isAuthenticated) { noteDone.value = {}; return }
  try {
    const res = await notesApi.listAll()
    const map: Record<number, boolean> = {}
    for (const n of res.data) map[n.paper_id] = n.completed
    noteDone.value = map
  } catch { noteDone.value = {} }
}
function noteState(id: number): 'none' | 'has' | 'done' {
  if (!(id in noteDone.value)) return 'none'
  return noteDone.value[id] ? 'done' : 'has'
}
function openNotes(id: number, e: Event) { e.stopPropagation(); router.push(`/papers/${id}?view=note`) }

onMounted(() => {
  const tagsParam = route.query.tags as string
  if (tagsParam) {
    selectedTagIds.value = tagsParam.split(',').map(Number).filter(n => !isNaN(n))
  }
  tagsStore.ensureLoaded()
  fetchWithFilters()
  loadNoteStatuses()
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
  promotingId.value = paper.id
  try {
    await store.promote(paper.id)
    // Fetching a metadata-only paper is an add: put it in the user's own list too.
    if (auth.user) await store.setInLibrary(paper.id, true)
    fetchWithFilters(store.pagination.page)
  } catch {
    // Backend rejected — the error toast is already shown by the API client and local
    // state is left unchanged.
  } finally {
    promotingId.value = null
  }
}

function setScope(value: 'mine' | 'all') {
  if (store.scope === value) return
  store.setScope(value)
  fetchWithFilters(1)
}
const libraryBusyId = ref<number | null>(null)
async function addToMyList(paper: any) {
  libraryBusyId.value = paper.id
  try { await store.setInLibrary(paper.id, true) } finally { libraryBusyId.value = null }
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
  if (addTab.value === 'corpus' && !s2Parsed.value) return
  adding.value = true
  try {
    const data: any = {}
    if (addTab.value === 'arxiv') data.arxiv_id = addForm.value.arxiv_id
    else if (addTab.value === 'corpus') Object.assign(data, s2Parsed.value)
    else {
      data.title = addForm.value.title
      data.authors = addForm.value.authors.split(',').map(s => s.trim()).filter(Boolean)
      data.content = addForm.value.content
      if (addForm.value.link) data.link = addForm.value.link
      if (addForm.value.tags.length > 0) data.tags = addForm.value.tags
    }
    const result = await store.createPaper(data)
    showAdd.value = false
    addForm.value = { arxiv_id: '', s2_input: '', title: '', authors: '', content: '', link: '', tags: [] }
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
        <Plus />Add paper
      </Button>
    </template>
    <div class="space-y-4">
    <div class="flex flex-wrap gap-2">
      <!-- Scope: my personal paper list vs the site-wide list (logged-in users only) -->
      <ScopeToggle v-if="auth.user" class="self-center" size="sm" :model-value="store.scope" @update:model-value="setScope" />
      <div class="relative w-full md:w-auto md:flex-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <Input v-model="search" @keyup.enter="onSearch" placeholder="Search titles and abstracts…" class="pl-9" />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline">
            <ArrowUpDown />{{ store.sortBy === 'updated_at' ? 'Last modified' : 'Date added' }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @click="setSort('created_at')">Date added</DropdownMenuItem>
          <DropdownMenuItem @click="setSort('updated_at')">Last modified</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline">
            {{ store.listedMode === 'all' ? 'All' : store.listedMode === 'unlisted' ? 'Metadata only' : 'Listed' }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @click="setListedMode('listed')">Listed</DropdownMenuItem>
          <DropdownMenuItem @click="setListedMode('unlisted')">Metadata only (not added)</DropdownMenuItem>
          <DropdownMenuItem @click="setListedMode('all')">All</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline" size="sm"
          @click="showTagFilter = !showTagFilter"
        >
          <Tag />Filter by tag
          <Badge v-if="selectedTagIds.length" variant="secondary">{{ selectedTagIds.length }}</Badge>
        </Button>
        <Button v-if="selectedTagIds.length > 0" variant="link" size="xs" @click="clearTagFilter">Clear filters</Button>
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
            <TableHead class="w-14 text-center">Notes</TableHead>
            <TableHead>Title</TableHead>
            <TableHead class="w-40 hidden md:table-cell">Authors</TableHead>
            <TableHead class="w-32">Source</TableHead>
            <TableHead class="w-16 hidden md:table-cell">Cited</TableHead>
            <TableHead class="w-16 hidden md:table-cell">Refs</TableHead>
            <TableHead class="w-24 hidden md:table-cell">Date added</TableHead>
            <TableHead class="w-24 hidden md:table-cell">Last modified</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="paper in store.papers" :key="paper.id"
            :class="paper.listed ? 'cursor-pointer' : 'opacity-70'"
            @click="onRowClick(paper)"
          >
            <TableCell class="text-center">
              <button
                class="inline-flex items-center justify-center p-1 rounded hover:bg-muted"
                :title="noteState(paper.id) === 'done' ? 'Done reading · Open notes' : noteState(paper.id) === 'has' ? 'Has notes · Open notes' : 'No notes · Open notes'"
                @click="openNotes(paper.id, $event)"
              >
                <CircleCheck v-if="noteState(paper.id) === 'done'" class="h-4 w-4 text-primary" />
                <Circle v-else-if="noteState(paper.id) === 'has'" class="h-4 w-4 text-foreground" />
                <CircleDashed v-else class="h-4 w-4 text-muted-foreground/40" />
              </button>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <div class="font-medium line-clamp-1">{{ paper.title }}</div>
                <Badge v-if="!paper.listed" variant="outline" class="shrink-0">Metadata only</Badge>
                <Button
                  v-if="!paper.listed"
                  size="xs" variant="secondary" class="shrink-0"
                  :disabled="promotingId === paper.id"
                  @click.stop="promote(paper)"
                >
                  {{ promotingId === paper.id ? 'Fetching…' : 'Fetch' }}
                </Button>
                <template v-if="auth.user && store.scope === 'all'">
                  <Badge v-if="paper.in_library" variant="secondary" class="shrink-0">In my list</Badge>
                  <Button
                    v-else
                    size="xs" variant="outline" class="shrink-0"
                    :disabled="libraryBusyId === paper.id"
                    title="Add to my paper list"
                    @click.stop="addToMyList(paper)"
                  ><Plus />My list</Button>
                </template>
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
              <CountCell :value="(paper as any).metadata?.reference_count" title="Number of papers this paper cites" />
            </TableCell>
            <TableCell class="text-muted-foreground text-xs hidden md:table-cell">{{ new Date(paper.created_at).toLocaleDateString() }}</TableCell>
            <TableCell class="text-muted-foreground text-xs hidden md:table-cell">{{ new Date(paper.updated_at).toLocaleDateString() }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <div v-if="store.papers.length === 0 && !store.loading" class="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <FileText class="h-10 w-10 mb-3 stroke-1" />
        <p class="text-sm">No papers yet</p>
        <p v-if="auth.user && store.scope === 'mine'" class="text-xs mt-1">
          Your list is empty — add a paper, or
          <button class="underline hover:text-foreground" @click="setScope('all')">browse All</button>
          and add papers to your list.
        </p>
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
          <DialogTitle>Add paper</DialogTitle>
        </DialogHeader>
        <Tabs v-model="addTab">
          <TabsList class="grid grid-cols-3 w-full">
            <TabsTrigger value="arxiv">arXiv ID</TabsTrigger>
            <TabsTrigger value="corpus">Semantic Scholar</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>
          <TabsContent value="arxiv">
            <Input v-model="addForm.arxiv_id" placeholder="e.g. 1706.03762" />
          </TabsContent>
          <TabsContent value="corpus" class="space-y-1.5">
            <Input v-model="addForm.s2_input" placeholder="Corpus ID / S2 paper ID / semanticscholar.org URL" />
            <p v-if="s2Invalid" class="text-xs text-destructive">Not recognized. Enter a Corpus ID, a 40-character S2 paper ID, or a Semantic Scholar paper URL.</p>
            <p v-else class="text-xs text-muted-foreground">e.g. 13756489, CorpusId:13756489, 204e3073…b72e776, or a paper page URL</p>
          </TabsContent>
          <TabsContent value="manual" class="space-y-3">
            <Input v-model="addForm.title" placeholder="Title" />
            <Input v-model="addForm.authors" placeholder="Authors (comma-separated)" />
            <Input v-model="addForm.link" placeholder="Source URL (optional)" />
            <Textarea v-model="addForm.content" placeholder="Paper content…" rows="4" />
            <TagSelector v-model="addForm.tags" />
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="ghost" @click="showAdd = false">Cancel</Button>
          <Button :disabled="adding || (addTab === 'corpus' && !s2Parsed)" @click="addPaper">
            {{ adding ? 'Adding…' : 'Add' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  </AppPage>
</template>
