<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useIdeaForgeStore } from '@/stores/idea-forge'
import { useTagsStore } from '@/stores/tags'
import { api } from '@/api/client'
import { Download, X, Check, Tag, FileText, Search } from 'lucide-vue-next'
import type { ProjectConfig } from '@paperland/shared'

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

// Tab: 'tags' | 'papers'
const tab = ref<'tags' | 'papers'>('tags')

// Tag mode state
const selectedTagIds = ref<number[]>([])
const editingFilter = ref(false)

// Paper mode state
const papers = ref<PaperListItem[]>([])
const selectedPaperIds = ref<number[]>([])
const paperSearch = ref('')
const loadingPapers = ref(false)

// Common state
const dumping = ref(false)
const dumpedCount = ref<number | null>(null)

const savedTagNames = computed(() => props.projectConfig?.paper_filter?.tag_names || [])
const hasSavedFilter = computed(() => savedTagNames.value.length > 0)

// Resolve saved tag names to IDs
const savedTagIds = computed(() => {
  return tagsStore.tags
    .filter(t => savedTagNames.value.includes(t.name))
    .map(t => t.id)
})

const filteredPapers = computed(() => {
  if (!paperSearch.value) return papers.value
  const q = paperSearch.value.toLowerCase()
  return papers.value.filter(p => p.title.toLowerCase().includes(q))
})

onMounted(async () => {
  await tagsStore.ensureLoaded()
  // Pre-select saved tags
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

function selectAllPapers() {
  selectedPaperIds.value = filteredPapers.value.map(p => p.id)
}

function deselectAllPapers() {
  selectedPaperIds.value = []
}

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
  const tagNames = tagsStore.tags
    .filter(t => selectedTagIds.value.includes(t.id))
    .map(t => t.name)
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
    const res = await ideaForge.dumpPapers(props.projectName, {
      paper_ids: selectedPaperIds.value,
    })
    dumpedCount.value = res.dumped_count
    emit('done', res.dumped_count)
  } finally {
    dumping.value = false
  }
}

function onTabPapers() {
  tab.value = 'papers'
  loadPapers()
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" @click.self="emit('close')">
    <div class="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col" style="max-height: 80vh">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
        <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Download class="h-5 w-5 text-indigo-600" />
          Dump Papers
        </h2>
        <button @click="emit('close')" class="rounded-md p-1 text-gray-400 hover:text-gray-600"><X class="h-5 w-5" /></button>
      </div>

      <!-- Success state -->
      <div v-if="dumpedCount !== null" class="text-center py-10 px-6">
        <Check class="h-10 w-10 mx-auto text-green-500 mb-3" />
        <p class="text-lg font-medium text-gray-900">{{ dumpedCount }} papers dumped</p>
        <p class="text-sm text-gray-500 mt-1">Papers exported to project directory</p>
        <button @click="emit('close')" class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 transition">
          Done
        </button>
      </div>

      <!-- Main content -->
      <template v-else>
        <!-- Tabs -->
        <div class="flex border-b border-gray-200 px-6 shrink-0">
          <button
            @click="tab = 'tags'"
            :class="['flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition',
              tab === 'tags' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700']"
          >
            <Tag class="h-3.5 w-3.5" /> By Tags
          </button>
          <button
            @click="onTabPapers"
            :class="['flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition',
              tab === 'papers' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700']"
          >
            <FileText class="h-3.5 w-3.5" /> Select Papers
          </button>
        </div>

        <!-- Tab: Tags -->
        <div v-if="tab === 'tags'" class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <!-- Saved filter quick-dump -->
          <div v-if="hasSavedFilter && !editingFilter" class="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-indigo-800">Saved filter</span>
              <button @click="editingFilter = true" class="text-xs text-indigo-600 hover:text-indigo-800">Edit</button>
            </div>
            <div class="flex flex-wrap gap-1.5 mb-3">
              <span v-for="name in savedTagNames" :key="name" class="rounded-full bg-white px-2.5 py-0.5 text-xs text-indigo-700 border border-indigo-200">
                {{ name }}
              </span>
            </div>
            <button
              @click="dumpByTags(savedTagIds)"
              :disabled="dumping"
              class="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {{ dumping ? 'Dumping...' : `Dump papers matching ${savedTagNames.length} tags` }}
            </button>
          </div>

          <!-- Tag selection (shown if no saved filter or editing) -->
          <div v-if="!hasSavedFilter || editingFilter">
            <p class="text-sm text-gray-600 mb-2">
              Select tags to filter papers. {{ hasSavedFilter ? 'This will also update the saved filter.' : 'These will be saved as the project filter.' }}
            </p>
            <div class="flex flex-wrap gap-2 mb-3 max-h-[200px] overflow-y-auto">
              <button
                v-for="tag in tagsStore.tags" :key="tag.id"
                @click="toggleTag(tag.id)"
                :class="[
                  'rounded-full px-3 py-1 text-xs font-medium border transition',
                  selectedTagIds.includes(tag.id)
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                ]"
              >
                {{ tag.name }}
                <span v-if="tag.paper_count" class="ml-1 text-gray-400">({{ tag.paper_count }})</span>
              </button>
              <span v-if="tagsStore.tags.length === 0" class="text-sm text-gray-400">No tags available</span>
            </div>
            <div class="flex justify-end gap-2">
              <button v-if="editingFilter" @click="editingFilter = false" class="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition">Cancel</button>
              <button
                v-if="selectedTagIds.length > 0"
                @click="saveTagFilter"
                class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                Save filter
              </button>
              <button
                @click="dumpByTags(selectedTagIds)"
                :disabled="dumping"
                class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {{ dumping ? 'Dumping...' : selectedTagIds.length ? `Dump (${selectedTagIds.length} tags)` : 'Dump All' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Tab: Papers -->
        <div v-else class="flex-1 overflow-hidden flex flex-col px-6 py-4">
          <div v-if="loadingPapers" class="text-center py-10 text-sm text-gray-400">Loading papers...</div>
          <template v-else>
            <!-- Search + select all -->
            <div class="flex items-center gap-2 mb-3 shrink-0">
              <div class="relative flex-1">
                <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  v-model="paperSearch"
                  placeholder="Search papers..."
                  class="w-full rounded-lg border border-gray-200 pl-8 pr-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
              <button @click="selectAllPapers" class="text-xs text-indigo-600 hover:text-indigo-800 whitespace-nowrap">Select all</button>
              <button @click="deselectAllPapers" class="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap">Clear</button>
            </div>

            <!-- Paper list -->
            <div class="flex-1 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              <label
                v-for="p in filteredPapers" :key="p.id"
                class="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer transition"
              >
                <input
                  type="checkbox"
                  :checked="selectedPaperIds.includes(p.id)"
                  @change="togglePaper(p.id)"
                  class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span class="text-sm text-gray-900 truncate">{{ p.title }}</span>
              </label>
              <div v-if="filteredPapers.length === 0" class="text-center py-8 text-sm text-gray-400">
                {{ paperSearch ? 'No papers match your search' : 'No papers in database' }}
              </div>
            </div>

            <!-- Dump button -->
            <div class="flex justify-end mt-3 shrink-0">
              <button
                @click="dumpByPapers"
                :disabled="dumping || selectedPaperIds.length === 0"
                class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {{ dumping ? 'Dumping...' : `Dump ${selectedPaperIds.length} selected papers` }}
              </button>
            </div>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>
