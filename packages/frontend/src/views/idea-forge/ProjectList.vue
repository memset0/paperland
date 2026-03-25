<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useIdeaForgeStore } from '@/stores/idea-forge'
import { Lightbulb, Plus, FolderOpen, FileText } from 'lucide-vue-next'

const store = useIdeaForgeStore()
const router = useRouter()
const showDialog = ref(false)
const newName = ref('')
const creating = ref(false)
const nameError = ref('')

onMounted(() => store.fetchProjects())

function openProject(name: string) {
  router.push(`/idea-forge/${encodeURIComponent(name)}`)
}

async function createProject() {
  nameError.value = ''
  const name = newName.value.trim()
  if (!name) { nameError.value = 'Name is required'; return }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(name)) { nameError.value = 'Lowercase letters, numbers, hyphens, underscores only'; return }
  creating.value = true
  try {
    await store.createProject(name)
    showDialog.value = false
    newName.value = ''
    openProject(name)
  } catch {
    nameError.value = 'Failed to create project'
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-8">
    <div class="flex items-center justify-between mb-8">
      <div class="flex items-center gap-3">
        <Lightbulb class="h-6 w-6 text-amber-500" />
        <h1 class="text-2xl font-bold text-gray-900">Idea Forge</h1>
      </div>
      <button
        @click="showDialog = true"
        class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
      >
        <Plus class="h-4 w-4" />
        New Project
      </button>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="text-center py-20 text-gray-400">Loading projects...</div>

    <!-- Empty state -->
    <div v-else-if="store.projects.length === 0" class="text-center py-20">
      <FolderOpen class="h-12 w-12 mx-auto text-gray-300 mb-4" />
      <p class="text-gray-500 mb-4">No projects yet</p>
      <button
        @click="showDialog = true"
        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
      >
        Create your first project
      </button>
    </div>

    <!-- Project grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <button
        v-for="p in store.projects" :key="p.name"
        @click="openProject(p.name)"
        class="text-left rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-300 hover:shadow-md transition group"
      >
        <div class="flex items-start justify-between mb-3">
          <h3 class="font-semibold text-gray-900 group-hover:text-indigo-700 transition">{{ p.name }}</h3>
          <FolderOpen class="h-4 w-4 text-gray-300 group-hover:text-indigo-400 transition shrink-0" />
        </div>
        <div class="flex gap-4 text-xs text-gray-500">
          <span class="flex items-center gap-1">
            <Lightbulb class="h-3.5 w-3.5" />
            {{ p.idea_count }} ideas
          </span>
          <span class="flex items-center gap-1">
            <FileText class="h-3.5 w-3.5" />
            {{ p.paper_count }} papers
          </span>
        </div>
      </button>
    </div>

    <!-- Create dialog -->
    <Teleport to="body">
      <div v-if="showDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" @click.self="showDialog = false">
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">New Project</h2>
          <input
            v-model="newName"
            placeholder="project-name"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            @keydown.enter="createProject"
            autofocus
          />
          <p v-if="nameError" class="mt-1 text-xs text-red-500">{{ nameError }}</p>
          <p class="mt-1 text-xs text-gray-400">Lowercase letters, numbers, hyphens, underscores</p>
          <div class="mt-4 flex justify-end gap-2">
            <button @click="showDialog = false" class="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 transition">Cancel</button>
            <button @click="createProject" :disabled="creating" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition">
              {{ creating ? 'Creating...' : 'Create' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
