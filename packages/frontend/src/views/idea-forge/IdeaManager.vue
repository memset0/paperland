<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIdeasStore } from '@/stores/ideas'
import { useIdeaForgeStore } from '@/stores/idea-forge'
import InboxView from '@/components/idea-forge/InboxView.vue'
import KanbanView from '@/components/idea-forge/KanbanView.vue'
import ListView from '@/components/idea-forge/ListView.vue'
import PaperDumpDialog from '@/components/idea-forge/PaperDumpDialog.vue'
import { ArrowLeft, Inbox, LayoutGrid, List, Download, Search } from 'lucide-vue-next'
import type { IdeaCategory } from '@paperland/shared'

const route = useRoute()
const router = useRouter()
const store = useIdeasStore()
const ideaForgeStore = useIdeaForgeStore()

const currentProject = computed(() => ideaForgeStore.projects.find(p => p.name === projectName.value))
const projectConfig = computed(() => currentProject.value?.config || {})

// Ensure projects are loaded for config
onMounted(() => {
  if (ideaForgeStore.projects.length === 0) ideaForgeStore.fetchProjects()
})

const projectName = computed(() => route.params.projectName as string)
const view = computed(() => (route.query.view as string) || 'inbox')

const sortField = ref('update_time')
const sortOrder = ref<'asc' | 'desc'>('desc')
const filterTag = ref('')
const filterCategories = ref<string[]>([])
const showDumpDialog = ref(false)
const inboxRef = ref<InstanceType<typeof InboxView> | null>(null)

const categories: IdeaCategory[] = ['unreviewed', 'under-review', 'validating', 'archived']

// Compute effective category filter: inbox defaults to unreviewed if no explicit filter
const effectiveCategoryFilter = computed(() => {
  if (filterCategories.value.length > 0) return filterCategories.value.join(',')
  if (view.value === 'inbox') return 'unreviewed'
  return undefined
})

async function loadIdeas() {
  await store.fetchIdeas(projectName.value, {
    category: effectiveCategoryFilter.value,
    tag: filterTag.value || undefined,
    sort: sortField.value,
    order: sortOrder.value,
  })
}

watch([projectName, sortField, sortOrder, filterTag, filterCategories, view], () => {
  loadIdeas()
}, { immediate: true })

function setView(v: string) {
  router.replace({ query: { ...route.query, view: v } })
}

function toggleCategoryFilter(cat: string) {
  const idx = filterCategories.value.indexOf(cat)
  if (idx >= 0) filterCategories.value.splice(idx, 1)
  else filterCategories.value.push(cat)
}

function toggleSort(field: string) {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortField.value = field
    sortOrder.value = 'desc'
  }
}

function goToInboxWithIdea(category: string, dirName: string) {
  // Switch to inbox view and select the idea
  if (view.value !== 'inbox') {
    router.replace({ query: { ...route.query, view: 'inbox' } })
  }
  // Clear category filter to show all, so the idea is visible
  filterCategories.value = [category]
  setTimeout(() => {
    inboxRef.value?.selectByKey(category, dirName)
  }, 100)
}

function onDumpDone(count: number) {
  // Refresh after dump (papers don't affect ideas, but project stats may)
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Top bar -->
    <div class="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-3">
          <button @click="router.push('/idea-forge')" class="rounded-md p-1 text-gray-400 hover:text-gray-600 transition">
            <ArrowLeft class="h-5 w-5" />
          </button>
          <h1 class="text-lg font-bold text-gray-900">{{ projectName }}</h1>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="showDumpDialog = true"
            class="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition"
          >
            <Download class="h-3.5 w-3.5" /> Dump Papers
          </button>
        </div>
      </div>

      <!-- Controls row -->
      <div class="flex items-center gap-3 flex-wrap">
        <!-- View toggles -->
        <div class="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            @click="setView('inbox')"
            :class="['flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition',
              view === 'inbox' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50']"
          >
            <Inbox class="h-3.5 w-3.5" /> Inbox
          </button>
          <button
            @click="setView('kanban')"
            :class="['flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition border-x border-gray-200',
              view === 'kanban' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50']"
          >
            <LayoutGrid class="h-3.5 w-3.5" /> Kanban
          </button>
          <button
            @click="setView('list')"
            :class="['flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition',
              view === 'list' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50']"
          >
            <List class="h-3.5 w-3.5" /> List
          </button>
        </div>

        <!-- Tag filter -->
        <div class="relative">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            v-model="filterTag"
            placeholder="Filter by tag..."
            class="rounded-lg border border-gray-200 pl-8 pr-3 py-1.5 text-xs w-40 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>

        <!-- Category filter chips -->
        <div class="flex gap-1.5 flex-wrap">
          <button
            v-for="cat in categories" :key="cat"
            @click="toggleCategoryFilter(cat)"
            :class="[
              'rounded-full px-2.5 py-1 text-[11px] font-medium transition border',
              filterCategories.includes(cat)
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            ]"
          >
            {{ cat }}
          </button>
        </div>

        <!-- Sort -->
        <div class="flex items-center gap-1 text-[11px] text-gray-500 ml-auto">
          <span>Sort:</span>
          <button
            @click="toggleSort('update_time')"
            :class="['px-1.5 py-0.5 rounded transition', sortField === 'update_time' ? 'bg-gray-200 text-gray-800 font-medium' : 'hover:bg-gray-100']"
          >
            Updated {{ sortField === 'update_time' ? (sortOrder === 'desc' ? '↓' : '↑') : '' }}
          </button>
          <button
            @click="toggleSort('create_time')"
            :class="['px-1.5 py-0.5 rounded transition', sortField === 'create_time' ? 'bg-gray-200 text-gray-800 font-medium' : 'hover:bg-gray-100']"
          >
            Created {{ sortField === 'create_time' ? (sortOrder === 'desc' ? '↓' : '↑') : '' }}
          </button>
        </div>
      </div>
    </div>

    <!-- View content -->
    <div class="flex-1 overflow-hidden">
      <InboxView
        v-if="view === 'inbox'"
        ref="inboxRef"
        :project-name="projectName"
        :ideas="store.ideas"
        @refresh="loadIdeas"
        @select-idea="goToInboxWithIdea"
      />
      <KanbanView
        v-else-if="view === 'kanban'"
        :project-name="projectName"
        :ideas="store.ideas"
        @click-idea="goToInboxWithIdea"
        @refresh="loadIdeas"
      />
      <ListView
        v-else
        :ideas="store.ideas"
        @click-idea="goToInboxWithIdea"
        @sort="toggleSort"
      />
    </div>

    <!-- Dump dialog -->
    <Teleport to="body">
      <PaperDumpDialog
        v-if="showDumpDialog"
        :project-name="projectName"
        :project-config="projectConfig"
        @close="showDumpDialog = false"
        @done="onDumpDone"
      />
    </Teleport>
  </div>
</template>
