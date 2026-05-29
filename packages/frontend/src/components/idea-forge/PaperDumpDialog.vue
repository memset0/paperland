<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useIdeaForgeStore } from '@/stores/idea-forge'
import { useTagsStore } from '@/stores/tags'
import { api } from '@/api/client'
import { Download, Check, Tag, FileText, Search } from '@lucide/vue'
import type { ProjectConfig } from '@paperland/shared'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface PaperListItem {
  id: number
  title: string
  tags_json: string | null
}

const props = defineProps<{
  projectName: string
  projectConfig: ProjectConfig
}>()

const emit = defineEmits<{
  close: []
  done: [count: number]
}>()

const ideaForge = useIdeaForgeStore()
const tagsStore = useTagsStore()

const open = ref(true)
const tab = ref<'tags' | 'papers'>('tags')

const selectedTagIds = ref<number[]>([])
const editingFilter = ref(false)

const papers = ref<PaperListItem[]>([])
const selectedPaperIds = ref<number[]>([])
const paperSearch = ref('')
const loadingPapers = ref(false)

const dumping = ref(false)
const dumpedCount = ref<number | null>(null)

const savedTagNames = computed(() => props.projectConfig?.paper_filter?.tag_names || [])
const hasSavedFilter = computed(() => savedTagNames.value.length > 0)

const savedTagIds = computed(() => tagsStore.tags.filter(t => savedTagNames.value.includes(t.name)).map(t => t.id))

const filteredPapers = computed(() => {
  if (!paperSearch.value) return papers.value
  const q = paperSearch.value.toLowerCase()
  return papers.value.filter(p => p.title.toLowerCase().includes(q))
})

onMounted(async () => {
  await tagsStore.ensureLoaded()
  if (hasSavedFilter.value) {
    selectedTagIds.value = [...savedTagIds.value]
  }
})

function toggleTag(id: number) {
  const idx = selectedTagIds.value.indexOf(id)
  if (idx >= 0) selectedTagIds.value.splice(idx, 1)
  else selectedTagIds.value.push(id)
}

function togglePaper(id: number) {
  const idx = selectedPaperIds.value.indexOf(id)
  if (idx >= 0) selectedPaperIds.value.splice(idx, 1)
  else selectedPaperIds.value.push(id)
}

function selectAllPapers() { selectedPaperIds.value = filteredPapers.value.map(p => p.id) }
function deselectAllPapers() { selectedPaperIds.value = [] }

async function loadPapers() {
  if (papers.value.length > 0) return
  loadingPapers.value = true
  try {
    const res = await api.get<{ data: PaperListItem[]; pagination: any }>('/api/papers?page_size=9999')
    papers.value = res.data
  } finally {
    loadingPapers.value = false
  }
}

async function saveTagFilter() {
  const tagNames = tagsStore.tags.filter(t => selectedTagIds.value.includes(t.id)).map(t => t.name)
  await ideaForge.updateProjectConfig(props.projectName, {
    paper_filter: tagNames.length > 0 ? { tag_names: tagNames } : undefined,
  })
  editingFilter.value = false
}

async function dumpByTags(tagIds?: number[]) {
  dumping.value = true
  try {
    const res = await ideaForge.dumpPapers(props.projectName, {
      tag_ids: tagIds && tagIds.length > 0 ? tagIds : undefined,
    })
    dumpedCount.value = res.dumped_count
    emit('done', res.dumped_count)
  } finally {
    dumping.value = false
  }
}

async function dumpByPapers() {
  if (selectedPaperIds.value.length === 0) return
  dumping.value = true
  try {
    const res = await ideaForge.dumpPapers(props.projectName, { paper_ids: selectedPaperIds.value })
    dumpedCount.value = res.dumped_count
    emit('done', res.dumped_count)
  } finally {
    dumping.value = false
  }
}

function onTabChange(v: string) {
  tab.value = v as 'tags' | 'papers'
  if (v === 'papers') loadPapers()
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => !v && handleClose()">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Download class="h-5 w-5 text-primary" />
          Dump Papers
        </DialogTitle>
      </DialogHeader>

      <div v-if="dumpedCount !== null" class="text-center py-10 space-y-3">
        <Check class="h-10 w-10 mx-auto text-primary" />
        <p class="text-lg font-medium">{{ dumpedCount }} papers dumped</p>
        <p class="text-sm text-muted-foreground">Papers exported to project directory</p>
        <Button @click="handleClose">Done</Button>
      </div>

      <Tabs v-else :model-value="tab" @update:model-value="onTabChange">
        <TabsList class="grid grid-cols-2 w-full">
          <TabsTrigger value="tags"><Tag />By Tags</TabsTrigger>
          <TabsTrigger value="papers"><FileText />Select Papers</TabsTrigger>
        </TabsList>

        <TabsContent value="tags" class="space-y-4">
          <Card v-if="hasSavedFilter && !editingFilter" class="p-4 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">Saved filter</span>
              <Button variant="link" size="xs" @click="editingFilter = true">Edit</Button>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <Badge v-for="name in savedTagNames" :key="name" variant="secondary">{{ name }}</Badge>
            </div>
            <Button class="w-full" :disabled="dumping" @click="dumpByTags(savedTagIds)">
              {{ dumping ? 'Dumping...' : `Dump papers matching ${savedTagNames.length} tags` }}
            </Button>
          </Card>

          <div v-if="!hasSavedFilter || editingFilter" class="space-y-3">
            <p class="text-sm text-muted-foreground">
              Select tags to filter papers. {{ hasSavedFilter ? 'This will also update the saved filter.' : 'These will be saved as the project filter.' }}
            </p>
            <div class="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto">
              <Badge
                v-for="tag in tagsStore.tags" :key="tag.id"
                as="button"
                :variant="selectedTagIds.includes(tag.id) ? 'default' : 'outline'"
                class="cursor-pointer"
                @click="toggleTag(tag.id)"
              >
                {{ tag.name }}
                <span v-if="tag.paper_count" class="opacity-60 ml-1">({{ tag.paper_count }})</span>
              </Badge>
              <span v-if="tagsStore.tags.length === 0" class="text-sm text-muted-foreground">No tags available</span>
            </div>
            <div class="flex justify-end gap-2">
              <Button v-if="editingFilter" variant="ghost" size="sm" @click="editingFilter = false">Cancel</Button>
              <Button v-if="selectedTagIds.length > 0" variant="outline" size="sm" @click="saveTagFilter">Save filter</Button>
              <Button size="sm" :disabled="dumping" @click="dumpByTags(selectedTagIds)">
                {{ dumping ? 'Dumping...' : selectedTagIds.length ? `Dump (${selectedTagIds.length} tags)` : 'Dump All' }}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="papers" class="flex flex-col">
          <div v-if="loadingPapers" class="text-center py-10 text-sm text-muted-foreground">Loading papers...</div>
          <template v-else>
            <div class="flex items-center gap-2 mb-3">
              <div class="relative flex-1">
                <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input v-model="paperSearch" placeholder="Search papers..." class="pl-8" />
              </div>
              <Button variant="link" size="xs" @click="selectAllPapers">Select all</Button>
              <Button variant="ghost" size="xs" @click="deselectAllPapers">Clear</Button>
            </div>

            <div class="overflow-y-auto rounded-md border divide-y max-h-[300px]">
              <label
                v-for="p in filteredPapers" :key="p.id"
                class="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer transition"
              >
                <Checkbox :model-value="selectedPaperIds.includes(p.id)" @update:model-value="togglePaper(p.id)" />
                <span class="text-sm truncate">{{ p.title }}</span>
              </label>
              <div v-if="filteredPapers.length === 0" class="text-center py-8 text-sm text-muted-foreground">
                {{ paperSearch ? 'No papers match your search' : 'No papers in database' }}
              </div>
            </div>

            <div class="flex justify-end mt-3">
              <Button :disabled="dumping || selectedPaperIds.length === 0" @click="dumpByPapers">
                {{ dumping ? 'Dumping...' : `Dump ${selectedPaperIds.length} selected papers` }}
              </Button>
            </div>
          </template>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>
