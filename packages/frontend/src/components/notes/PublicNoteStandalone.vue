<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { BookOpen, LogIn, Loader2 } from '@lucide/vue'
import { notesApi } from '@/api/client'
import type { NoteWithAuthor } from '@paperland/shared'
import { Button } from '@/components/ui/button'
import PublicNoteView from './PublicNoteView.vue'

// Anonymous view of a published-note link (`/papers/:id?note=:noteId`): just the note, no app
// shell and no paper data (those need login). Emits `unavailable` when the note can't be read
// anonymously (unpublished / deleted) and `login` from the Log in button; App shows the login
// screen for both.
const props = defineProps<{ noteId: number }>()
const emit = defineEmits<{ unavailable: []; login: [] }>()

const note = ref<NoteWithAuthor | null>(null)
const loading = ref(true)

onMounted(async () => {
  note.value = await notesApi.getById(props.noteId)
  loading.value = false
  if (!note.value) emit('unavailable')
  else document.title = `${note.value.paper_title} — note by ${note.value.display_name} · Paperland`
})
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-8">
    <div class="mb-6 flex items-center gap-2">
      <BookOpen class="h-5 w-5 text-primary" />
      <span class="font-semibold">Paperland</span>
      <Button variant="outline" size="sm" class="ml-auto" @click="emit('login')"><LogIn />Log in</Button>
    </div>
    <div v-if="loading" class="flex justify-center py-20 text-muted-foreground"><Loader2 class="h-5 w-5 animate-spin" /></div>
    <article v-else-if="note" class="rounded-xl border bg-background p-6">
      <h1 class="text-xl font-semibold leading-snug">{{ note.paper_title }}</h1>
      <p class="mt-1 mb-6 text-sm text-muted-foreground">Note by {{ note.display_name }} · {{ new Date(note.updated_at).toLocaleDateString() }}</p>
      <PublicNoteView :body="note.body" :paper-id="note.paper_id" />
    </article>
  </div>
</template>
