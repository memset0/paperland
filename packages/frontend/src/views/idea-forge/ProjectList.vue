<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useIdeaForgeStore } from '@/stores/idea-forge'
import { Lightbulb, Plus, FolderOpen, FileText } from '@lucide/vue'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import AppPage from '@/components/AppPage.vue'

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
  <AppPage>
    <template #actions>
      <Button @click="showDialog = true">
        <Plus />
        New Project
      </Button>
    </template>
    <div class="space-y-6">
    <div v-if="store.loading" class="text-center py-20 text-muted-foreground">Loading projects...</div>

    <div v-else-if="store.projects.length === 0" class="text-center py-20 space-y-4">
      <FolderOpen class="h-12 w-12 mx-auto text-muted-foreground/40" />
      <p class="text-muted-foreground">No projects yet</p>
      <Button @click="showDialog = true">Create your first project</Button>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card
        v-for="p in store.projects" :key="p.name"
        as="button"
        class="text-left p-5 hover:shadow-md transition group"
        @click="openProject(p.name)"
      >
        <div class="flex items-start justify-between">
          <h3 class="font-semibold">{{ p.name }}</h3>
          <FolderOpen class="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
        <div class="flex gap-4 text-xs text-muted-foreground">
          <span class="flex items-center gap-1">
            <Lightbulb class="h-3.5 w-3.5" />
            {{ p.idea_count }} ideas
          </span>
          <span class="flex items-center gap-1">
            <FileText class="h-3.5 w-3.5" />
            {{ p.paper_count }} papers
          </span>
        </div>
      </Card>
    </div>

    <Dialog v-model:open="showDialog">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>Lowercase letters, numbers, hyphens, underscores</DialogDescription>
        </DialogHeader>
        <div class="space-y-1.5">
          <Input
            v-model="newName"
            placeholder="project-name"
            autofocus
            @keydown.enter="createProject"
          />
          <p v-if="nameError" class="text-xs text-destructive">{{ nameError }}</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="showDialog = false">Cancel</Button>
          <Button :disabled="creating" @click="createProject">
            {{ creating ? 'Creating...' : 'Create' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  </AppPage>
</template>
