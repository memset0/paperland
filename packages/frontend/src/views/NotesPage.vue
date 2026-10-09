<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { notesApi } from '@/api/client'
import type { NoteWithAuthor } from '@paperland/shared'
import { usePageTitle } from '@/composables/usePageTitle'
import { useAuthStore } from '@/stores/auth'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, FileText, Globe, Lock } from '@lucide/vue'
import AppPage from '@/components/AppPage.vue'

// One note per (user, paper). The scope toggle switches between the current user's own notes and
// All: published + shared notes of others (admins: every note, unshared ones marked Private).
// Selecting a note opens its paper — another user's note opens in the right-panel others' notes
// view (via `?note=`), while the user's own note just navigates (it lives in their own Note tab).
const router = useRouter()
const auth = useAuthStore()
const all = ref<NoteWithAuthor[]>([])
const loading = ref(true)
const query = ref('')
const scope = ref<'mine' | 'all'>('mine')

usePageTitle(() => 'Notes')

async function load() {
  loading.value = true
  try {
    const res = await notesApi.listAll({ scope: scope.value })
    all.value = res.data
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(scope, load)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = [...all.value].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  if (!q) return list
  return list.filter(
    (n) => n.paper_title.toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q) || n.username.toLowerCase().includes(q) || n.display_name.toLowerCase().includes(q),
  )
})

function isOwn(n: NoteWithAuthor): boolean {
  return auth.user != null && n.user_id === auth.user.id
}

function openNote(n: NoteWithAuthor) {
  // Another user's note → deep-link so it opens in the right-panel public notes view.
  // Own note → plain navigation (it already lives in the user's own Note tab).
  router.push(isOwn(n) ? `/papers/${n.paper_id}` : `/papers/${n.paper_id}?note=${n.id}`)
}

function snippet(body: string): string {
  return body.replace(/[#*`>[\]()_~-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
}
</script>

<template>
  <AppPage>
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <!-- Scope: my notes vs everyone's -->
        <div class="flex items-center rounded border overflow-hidden text-sm shrink-0">
          <button
            class="px-3 py-1"
            :class="scope === 'mine' ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'"
            @click="scope = 'mine'"
          >Mine</button>
          <button
            class="px-3 py-1"
            :class="scope === 'all' ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'"
            @click="scope = 'all'"
          >All</button>
        </div>
        <Input v-model="query" placeholder="Search notes…" class="flex-1 min-w-[12rem]" />
      </div>

      <div v-if="loading" class="flex justify-center py-16">
        <Loader2 class="h-5 w-5 animate-spin text-primary" />
      </div>
      <div v-else-if="!filtered.length" class="text-sm text-muted-foreground text-center py-16">
        {{ all.length ? 'No matching notes.' : 'No notes yet.' }}
      </div>
      <Card v-else class="divide-y overflow-hidden py-0">
        <button
          v-for="n in filtered" :key="n.id"
          class="block w-full text-left px-4 py-3 hover:bg-muted/40"
          @click="openNote(n)"
        >
          <div class="flex items-center gap-2">
            <div class="text-sm font-medium inline-flex items-center gap-1.5 min-w-0">
              <FileText class="h-3.5 w-3.5 shrink-0" /> <span class="truncate">{{ n.paper_title }}</span>
            </div>
            <Badge v-if="n.is_public" variant="secondary" class="gap-1 shrink-0"><Globe class="h-3 w-3" /> Published</Badge>
            <!-- Not visible to other users (owner's notes switch off): own notes, or admin view of others' -->
            <Badge v-if="!n.shared" variant="outline" class="gap-1 shrink-0"><Lock class="h-3 w-3" /> Private</Badge>
            <span v-if="!isOwn(n)" class="text-xs text-muted-foreground shrink-0 ml-auto">{{ n.display_name }}</span>
          </div>
          <div v-if="snippet(n.body)" class="text-xs text-muted-foreground line-clamp-2 mt-0.5">{{ snippet(n.body) }}</div>
        </button>
      </Card>
    </div>
  </AppPage>
</template>
