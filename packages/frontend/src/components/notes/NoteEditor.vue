<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useNotesStore } from '@/stores/notes'
import { useWindowsStore, type NoteWindow } from '@/stores/windows'
import MarkdownContent from '@/components/MarkdownContent.vue'
import { Pencil, Eye, Columns } from '@lucide/vue'

// Markdown editor with three display modes. All state is frontend-only; saving goes
// through the notes store (root-note upsert or per-note PATCH) with 2s debounce,
// commit-on-blur, Ctrl+S, and IME-safe scheduling.
const ROOT_LABEL = '(root)'
const props = defineProps<{ win: NoteWindow }>()
const notes = useNotesStore()
const windows = useWindowsStore()

type Mode = 'editor' | 'split' | 'preview'
const mode = ref<Mode>('split')

const editBody = ref('')
const editTitle = ref('')
const saving = ref(false)
const composing = ref(false) // true while an IME composition is in progress
let savePending = false       // a save was requested while another was in flight
let saveTimer: ReturnType<typeof setTimeout> | null = null

function syncFromStore() {
  if (props.win.kind === 'root') {
    editBody.value = notes.root?.body ?? ''
    editTitle.value = ROOT_LABEL
  } else {
    const n = notes.notes.find((x) => x.id === props.win.noteId)
    editBody.value = n?.body ?? ''
    editTitle.value = n?.title ?? ''
  }
}

function clearTimer() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
}

function scheduleSave() {
  if (composing.value) return // don't autosave mid-IME-composition
  clearTimer()
  saveTimer = setTimeout(doSave, 2000)
}

async function doSave() {
  clearTimer()
  if (saving.value) { savePending = true; return } // don't drop; re-run after the current save
  saving.value = true
  try {
    if (props.win.kind === 'root') {
      await notes.saveRoot(editBody.value)
    } else if (props.win.noteId != null) {
      await notes.updateNote(props.win.noteId, { title: editTitle.value, body: editBody.value })
      windows.setTitle(props.win.key, editTitle.value || '(untitled)')
    }
  } finally {
    saving.value = false
    if (savePending) { savePending = false; doSave() }
  }
}

function immediateSave() {
  if (composing.value) return
  clearTimer()
  doSave()
}

function onCompositionStart() {
  composing.value = true
  clearTimer() // make sure no save fires while composing
}
function onCompositionEnd() {
  composing.value = false
  scheduleSave()
}

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    immediateSave()
  }
}

onMounted(() => {
  syncFromStore()
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  // Flush a pending edit on close/unmount (fire-and-forget; the PATCH still lands).
  if (saveTimer) { clearTimer(); doSave() }
})

const modes: { value: Mode; icon: typeof Pencil; label: string }[] = [
  { value: 'editor', icon: Pencil, label: 'Editor' },
  { value: 'split', icon: Columns, label: 'Split' },
  { value: 'preview', icon: Eye, label: 'Preview' },
]
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex items-center gap-2 px-2 py-1 border-b shrink-0">
      <input
        v-if="win.kind === 'note'"
        v-model="editTitle"
        placeholder="Title"
        class="flex-1 min-w-0 bg-transparent text-xs font-medium outline-none px-1"
        @input="scheduleSave"
        @change="immediateSave"
        @compositionstart="onCompositionStart"
        @compositionend="onCompositionEnd"
      />
      <span v-else class="flex-1 text-xs text-muted-foreground">{{ ROOT_LABEL }}</span>
      <span v-if="saving" class="text-[10px] text-muted-foreground shrink-0">Saving…</span>
      <div class="flex items-center rounded border overflow-hidden shrink-0">
        <button
          v-for="m in modes" :key="m.value"
          class="px-1.5 py-0.5"
          :class="mode === m.value ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'"
          :title="m.label"
          @click="mode = m.value"
        >
          <component :is="m.icon" class="h-3 w-3" />
        </button>
      </div>
    </div>

    <div class="flex-1 min-h-0 flex">
      <textarea
        v-if="mode !== 'preview'"
        v-model="editBody"
        class="min-w-0 resize-none p-3 text-sm font-mono outline-none bg-transparent"
        :class="mode === 'split' ? 'border-r w-1/2' : 'w-full'"
        placeholder="Markdown…"
        @input="scheduleSave"
        @change="immediateSave"
        @compositionstart="onCompositionStart"
        @compositionend="onCompositionEnd"
      />
      <div
        v-if="mode !== 'editor'"
        class="min-w-0 overflow-y-auto p-3"
        :class="mode === 'split' ? 'w-1/2' : 'w-full'"
      >
        <MarkdownContent :content="editBody" :paper-id="win.paperId" class="text-sm" />
      </div>
    </div>
  </div>
</template>
