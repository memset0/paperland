<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { loadMonaco, monacoThemeFor } from '@/lib/monaco'
import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api'

// Shared Monaco-based Markdown editor used by both the floating note windows
// (NoteEditor.vue) and the left-panel edit/split editor (NoteWalkthrough.vue).
// It exposes a `v-model` contract and emits the events those parents already
// react to (composition / blur / save / paste), so all the autosave, IME guard,
// heading-demotion and conflict logic stays in the parents — this component only
// changes how text is displayed and entered. Monaco is lazy-loaded; a placeholder
// is shown until it is ready.
const props = withDefaults(
  defineProps<{
    modelValue: string
    readonly?: boolean
    placeholder?: string
  }>(),
  { readonly: false, placeholder: '' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  compositionstart: []
  compositionend: []
  blur: []
  save: []
  paste: [e: ClipboardEvent]
}>()

const theme = useThemeStore()
const host = ref<HTMLElement | null>(null)
const loading = ref(true)

let editor: Monaco.editor.IStandaloneCodeEditor | null = null
let monaco: typeof Monaco | null = null
let composing = false // mirror Vue v-model: no model update mid-IME-composition
let suppressChange = false // guard the feedback loop when pushing external values in
let pasteEl: HTMLTextAreaElement | null = null
let onPasteDom: ((e: ClipboardEvent) => void) | null = null
const disposables: Monaco.IDisposable[] = []

onMounted(async () => {
  monaco = await loadMonaco()
  if (!host.value) return // unmounted while Monaco was loading

  editor = monaco.editor.create(host.value, {
    value: props.modelValue,
    language: 'markdown',
    theme: monacoThemeFor(theme.resolved),
    readOnly: props.readonly,
    // Prose-oriented chrome — feel like the textarea it replaces, not an IDE.
    wordWrap: 'on',
    wrappingIndent: 'same',
    minimap: { enabled: false },
    lineNumbers: 'on',
    folding: false,
    glyphMargin: false,
    lineDecorationsWidth: 8,
    lineNumbersMinChars: 3,
    renderLineHighlight: 'none',
    overviewRulerLanes: 0,
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    scrollBeyondLastLine: false,
    scrollbar: { horizontal: 'hidden', verticalScrollbarSize: 8, useShadows: false },
    quickSuggestions: false,
    suggestOnTriggerCharacters: false,
    occurrencesHighlight: 'off',
    unicodeHighlight: { ambiguousCharacters: false, invisibleCharacters: false },
    fontSize: 14,
    fontFamily: "'Noto Sans Mono Variable', ui-monospace, SFMono-Regular, monospace",
    padding: { top: 12, bottom: 12 },
    automaticLayout: true,
    contextmenu: false,
    smoothScrolling: true,
  })
  loading.value = false

  disposables.push(
    editor.onDidChangeModelContent(() => {
      if (suppressChange || composing) return
      emit('update:modelValue', editor!.getValue())
    }),
    editor.onDidCompositionStart(() => {
      composing = true
      emit('compositionstart')
    }),
    editor.onDidCompositionEnd(() => {
      composing = false
      emit('compositionend')
      // Flush the composed text now that the model is settled.
      if (!suppressChange) emit('update:modelValue', editor!.getValue())
    }),
    editor.onDidBlurEditorWidget(() => emit('blur')),
  )
  // Ctrl/Cmd+S — commit. Bound as an editor command so Monaco doesn't trigger the
  // browser's "save page"; the parent decides what `save` does.
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => emit('save'))

  // Native paste (with clipboardData image blobs) for paste-to-upload — attach to
  // Monaco's hidden input textarea so we get the raw event, not just text.
  pasteEl = host.value.querySelector('textarea.inputarea')
  if (pasteEl) {
    onPasteDom = (e: ClipboardEvent) => emit('paste', e)
    pasteEl.addEventListener('paste', onPasteDom)
  }
})

// Push external modelValue changes into the editor without re-emitting (preserve cursor).
watch(
  () => props.modelValue,
  (v) => {
    if (!editor || v === editor.getValue()) return
    suppressChange = true
    const pos = editor.getPosition()
    editor.setValue(v)
    if (pos) editor.setPosition(pos)
    suppressChange = false
  },
)
watch(
  () => props.readonly,
  (ro) => editor?.updateOptions({ readOnly: ro }),
)
watch(
  () => theme.resolved,
  (r) => monaco?.editor.setTheme(monacoThemeFor(r)),
)

defineExpose({
  focus: () => editor?.focus(),
  getEditor: () => editor,
  /** Replace the current selection with `text` (used to drop an uploaded image link at the cursor). */
  insertAtCursor: (text: string) => {
    if (!editor) return
    const sel = editor.getSelection()
    if (!sel) return
    editor.executeEdits('insert', [{ range: sel, text, forceMoveMarkers: true }])
    editor.focus()
  },
})

onBeforeUnmount(() => {
  if (pasteEl && onPasteDom) pasteEl.removeEventListener('paste', onPasteDom)
  disposables.forEach((d) => d.dispose())
  editor?.dispose()
  editor = null
})
</script>

<template>
  <div class="relative h-full min-w-0 overflow-hidden">
    <div ref="host" class="h-full w-full"></div>
    <div
      v-if="loading"
      class="absolute inset-0 p-3 text-sm font-mono text-muted-foreground pointer-events-none"
    >
      {{ placeholder || 'Loading editor…' }}
    </div>
  </div>
</template>
