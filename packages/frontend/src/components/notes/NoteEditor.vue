<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'
import { useNotesStore } from '@/stores/notes'
import { type NoteWindow } from '@/stores/windows'
import { demoteHeadings } from '@/lib/markdown-doc'
import MarkdownContent from '@/components/MarkdownContent.vue'
import MonacoMarkdownEditor from '@/components/notes/MonacoMarkdownEditor.vue'
import { uploadImage, imageFromClipboard } from '@/utils/uploadImage'
import { Pencil, Eye, Columns } from '@lucide/vue'

// Floating editor for ONE section's leaf content (or the preamble for the center node). Edits
// write through to the single shared document; headings typed here are demoted to bold so a
// window can never change structure. A strict binding (structure key + the section's own content
// baseline) refuses to write — surfacing a conflict — if the section changed underneath us.
const props = defineProps<{ win: NoteWindow }>()
const store = useNotesStore()

type Mode = 'editor' | 'split' | 'preview'
const mode = ref<Mode>('split')

const editBody = ref('')
const conflict = ref(false)
const uploadingImage = ref(false)
const editorRef = ref<InstanceType<typeof MonacoMarkdownEditor> | null>(null)
const composing = ref(false)
let saveTimer: ReturnType<typeof setTimeout> | null = null

// Concurrency binding captured at open (design D7): structure key + this section's content baseline.
let boundStructureKey = ''
let lastSyncedLeaf = ''

const isDoc = computed(() => props.win.kind === 'doc')
const isPreamble = computed(() => props.win.sectionId == null)
// What the saved document will contain. The whole-doc editor keeps headings; section windows
// demote them to bold (so a section window can't change structure).
const previewContent = computed(() => (isDoc.value || isPreamble.value ? editBody.value : demoteHeadings(editBody.value)))

function loadFromStore() {
  conflict.value = false
  if (isDoc.value) { editBody.value = store.body; return } // whole-document editor: bind the whole body
  editBody.value = isPreamble.value
    ? store.tree.preamble
    : (store.sectionBaseline(props.win.sectionId as string) ?? '')
  boundStructureKey = store.structureKey()
  lastSyncedLeaf = isPreamble.value ? store.tree.preamble : (store.sectionBaseline(props.win.sectionId as string) ?? '')
}

function clearTimer() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null } }
function scheduleSave() { if (composing.value) return; clearTimer(); saveTimer = setTimeout(commit, 1200) }

/** Write the window's text through to the shared document, guarded by the binding. */
function commit() {
  clearTimer()
  if (composing.value || conflict.value) return
  if (isDoc.value) { store.setBody(editBody.value); return } // whole-document write-through
  // Structure must be unchanged since we opened (structural edits close windows; cross-tab reload would change it).
  if (store.structureKey() !== boundStructureKey) { conflict.value = true; return }
  if (isPreamble.value) {
    store.updatePreamble(editBody.value)
    lastSyncedLeaf = store.tree.preamble
    return
  }
  const sectionId = props.win.sectionId as string
  const current = store.sectionBaseline(sectionId)
  if (current == null) { conflict.value = true; return }      // section vanished
  if (current !== lastSyncedLeaf) { conflict.value = true; return } // changed elsewhere
  if (!store.updateLeaf(sectionId, editBody.value)) { conflict.value = true; return }
  lastSyncedLeaf = store.sectionBaseline(sectionId) ?? ''
}

// Editor content changed (mirrors the textarea's `@input`): mirror into editBody and
// schedule a debounced save. The wrapper suppresses updates mid-IME-composition.
function onEditorInput(v: string) { editBody.value = v; scheduleSave() }

function onCompositionStart() { composing.value = true; clearTimer() }
function onCompositionEnd() { composing.value = false; scheduleSave() }
function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); commit() }
}

async function onPaste(e: ClipboardEvent) {
  const file = imageFromClipboard(e)
  if (!file) return
  e.preventDefault()
  if (uploadingImage.value) return
  uploadingImage.value = true
  try {
    const { markdown } = await uploadImage(file)
    editorRef.value?.insertAtCursor(markdown) // → update:modelValue → editBody updates
    commit()
  } catch {
    toast.error('Image upload failed')
  } finally {
    uploadingImage.value = false
  }
}

onMounted(() => {
  loadFromStore()
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (saveTimer) { clearTimer(); commit() } // flush a pending edit on close
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
      <span class="flex-1 min-w-0 truncate text-xs font-medium px-1">{{ win.title }}</span>
      <span v-if="uploadingImage" class="text-[10px] text-primary shrink-0">Uploading image…</span>
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

    <div v-if="conflict" class="px-3 py-2 text-[11px] bg-destructive/10 text-destructive border-b shrink-0">
      This section changed elsewhere — your text below is preserved. Copy it out, then close and reopen the editor.
    </div>
    <div v-else-if="!isPreamble" class="px-3 py-1 text-[10px] text-muted-foreground border-b shrink-0">
      Editing this section only · headings you type become bold (structure is edited in the map / full note).
    </div>

    <div class="flex-1 min-h-0 flex">
      <MonacoMarkdownEditor
        v-if="mode !== 'preview'"
        ref="editorRef"
        :model-value="editBody"
        :class="mode === 'split' ? 'border-r w-1/2' : 'w-full'"
        placeholder="Markdown…"
        @update:model-value="onEditorInput"
        @save="commit"
        @blur="commit"
        @paste="onPaste"
        @compositionstart="onCompositionStart"
        @compositionend="onCompositionEnd"
      />
      <div
        v-if="mode !== 'editor'"
        class="min-w-0 overflow-y-auto p-3"
        :class="mode === 'split' ? 'w-1/2' : 'w-full'"
      >
        <MarkdownContent :content="previewContent" :paper-id="win.paperId" class="text-sm" />
      </div>
    </div>
  </div>
</template>
