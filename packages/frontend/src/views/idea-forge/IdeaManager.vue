<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIdeasStore } from '@/stores/ideas'
import { useIdeaForgeStore } from '@/stores/idea-forge'
import { usePageTitle } from '@/composables/usePageTitle'
import InboxView from '@/components/idea-forge/InboxView.vue'
import KanbanView from '@/components/idea-forge/KanbanView.vue'
import ListView from '@/components/idea-forge/ListView.vue'
import PaperDumpDialog from '@/components/idea-forge/PaperDumpDialog.vue'
import { ArrowLeft, Inbox, LayoutGrid, List, Download, Search } from '@lucide/vue'
import { IDEA_CATEGORIES } from '@/lib/idea-categories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const route = useRoute()
const router = useRouter()
const store = useIdeasStore()
const ideaForgeStore = useIdeaForgeStore()

const currentProject = computed(() => ideaForgeStore.projects.find(p => p.name === projectName.value))
const projectConfig = computed(() => currentProject.value?.config || {})

onMounted(() => {
  if (ideaForgeStore.projects.length === 0) ideaForgeStore.fetchProjects()
})

const projectName = computed(() => route.params.projectName as string)
const view = computed(() => (route.query.view as string) || 'inbox')

// Browser tab title follows the open Idea Forge project.
usePageTitle(() => projectName.value)

const sortField = ref('update_time')
const sortOrder = ref<'asc' | 'desc'>('desc')
const filterTag = ref('')
const filterCategories = ref<string[]>([])
const showDumpDialog = ref(false)
const inboxRef = ref<InstanceType<typeof InboxView> | null>(null)

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

function setView(v: string | number) {
  router.replace({ query: { ...route.query, view: String(v) } })
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
  if (view.value !== 'inbox') {
    router.replace({ query: { ...route.query, view: 'inbox' } })
  }
  filterCategories.value = [category]
  setTimeout(() => {
    inboxRef.value?.selectByKey(category, dirName)
  }, 100)
}

function onDumpDone(_count: number) {}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="shrink-0 border-b bg-background px-4 py-3 space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" @click="router.push('/idea-forge')">
            <ArrowLeft />
          </Button>
          <h1 class="text-lg font-bold">{{ projectName }}</h1>
        </div>
        <Button variant="outline" size="sm" @click="showDumpDialog = true">
          <Download />Dump Papers
        </Button>
      </div>

      <div class="flex items-center gap-3 flex-wrap">
        <Tabs :model-value="view" @update:model-value="setView">
          <TabsList>
            <TabsTrigger value="inbox"><Inbox />Inbox</TabsTrigger>
            <TabsTrigger value="kanban"><LayoutGrid />Kanban</TabsTrigger>
            <TabsTrigger value="list"><List />List</TabsTrigger>
          </TabsList>
        </Tabs>

        <div class="relative">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input v-model="filterTag" placeholder="Filter by tag..." class="pl-8 w-40" />
        </div>

        <div class="flex gap-1.5 flex-wrap">
          <Badge
            v-for="cat in IDEA_CATEGORIES" :key="cat"
            as="button"
            :variant="filterCategories.includes(cat) ? 'default' : 'outline'"
            class="cursor-pointer"
            @click="toggleCategoryFilter(cat)"
          >
            {{ cat }}
          </Badge>
        </div>

        <div class="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
          <span>Sort:</span>
          <Button
            variant="ghost" size="xs"
            :class="sortField === 'update_time' ? 'bg-muted' : ''"
            @click="toggleSort('update_time')"
          >
            Updated {{ sortField === 'update_time' ? (sortOrder === 'desc' ? '↓' : '↑') : '' }}
          </Button>
          <Button
            variant="ghost" size="xs"
            :class="sortField === 'create_time' ? 'bg-muted' : ''"
            @click="toggleSort('create_time')"
          >
            Created {{ sortField === 'create_time' ? (sortOrder === 'desc' ? '↓' : '↑') : '' }}
          </Button>
        </div>
      </div>
    </div>

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

    <PaperDumpDialog
      v-if="showDumpDialog"
      :project-name="projectName"
      :project-config="projectConfig"
      @close="showDumpDialog = false"
      @done="onDumpDone"
    />
  </div>
</template>
