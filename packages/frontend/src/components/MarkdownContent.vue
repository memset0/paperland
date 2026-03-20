<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount, computed } from 'vue'
import MarkdownIt from 'markdown-it'
import mk from '@traptitech/markdown-it-katex'
import SparkMD5 from 'spark-md5'
import 'katex/dist/katex.min.css'
import { useHighlightStore } from '@/stores/highlights'
import { applyHighlights, clearHighlights, getSelectionOffsets } from '@/composables/useHighlight'
import type { HighlightColor } from '@paperland/shared'

const props = defineProps<{ content: string; highlightPathname?: string }>()

const highlightStore = useHighlightStore()
const containerRef = ref<HTMLElement | null>(null)

// Toolbar state
const showToolbar = ref(false)
const toolbarPos = ref({ x: 0, y: 0 })
const pendingSelection = ref<{ start_offset: number; end_offset: number; text: string } | null>(null)
const showNoteInput = ref(false)
const noteText = ref('')

// Tooltip state
const showTooltip = ref(false)
const tooltipPos = ref({ x: 0, y: 0 })
const tooltipNote = ref('')

// Click menu state
const showMenu = ref(false)
const menuPos = ref({ x: 0, y: 0 })
const menuHighlightId = ref<number | null>(null)
const menuEditNote = ref(false)
const menuNoteText = ref('')

// Configure markdown-it once
const md = new MarkdownIt({ breaks: true, linkify: true, html: false })
md.use(mk, { throwOnError: false })

/** Compute content hash: MD5 of content with all whitespace removed */
const contentHash = computed(() => {
  if (!props.content) return ''
  const stripped = props.content.replace(/\s/g, '')
  return SparkMD5.hash(stripped)
})

/** Get highlights for this specific content from the store */
const myHighlights = computed(() => {
  if (!contentHash.value) return []
  return highlightStore.getForHash(contentHash.value)
})

/** Render markdown and apply highlights */
function renderAndHighlight() {
  const el = containerRef.value
  if (!el) return

  // Render markdown to HTML
  el.innerHTML = md.render(props.content)

  // Apply highlights after DOM update
  nextTick(() => {
    if (!el || myHighlights.value.length === 0) return
    applyHighlights(el, myHighlights.value)
  })
}

// Watch content changes
watch(() => props.content, () => {
  closeAllPopups()
  renderAndHighlight()
}, { immediate: false })

// Watch highlight changes (e.g., after create/delete)
watch(myHighlights, () => {
  renderAndHighlight()
}, { deep: true })

onMounted(() => {
  renderAndHighlight()
  document.addEventListener('mousedown', onDocumentMouseDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown)
})

// ---- Selection & Toolbar ----

function onMouseUp(e: MouseEvent) {
  // Don't show toolbar if clicking on toolbar or menu
  if ((e.target as Element)?.closest('.hl-toolbar, .hl-menu, .hl-tooltip')) return

  const el = containerRef.value
  if (!el) return

  if (!props.content) {
    // Empty content guard
    alert('内容为空，无法创建高亮。请检查组件是否正确接收了内容数据。')
    return
  }

  // Small delay to let selection settle
  setTimeout(() => {
    const offsets = getSelectionOffsets(el)
    if (!offsets) {
      showToolbar.value = false
      return
    }

    pendingSelection.value = offsets

    // Position toolbar below selection
    const selection = window.getSelection()
    const containerRect = el.getBoundingClientRect()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const rangeRect = range.getBoundingClientRect()
      toolbarPos.value = {
        x: rangeRect.left + rangeRect.width / 2 - containerRect.left,
        y: rangeRect.bottom - containerRect.top + 6,
      }
    } else {
      toolbarPos.value = {
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top + 6,
      }
    }
    showToolbar.value = true
    showNoteInput.value = false
    noteText.value = ''
  }, 10)
}

async function createHighlight(color: HighlightColor) {
  if (!pendingSelection.value || !contentHash.value) return

  await highlightStore.create({
    content_hash: contentHash.value,
    start_offset: pendingSelection.value.start_offset,
    end_offset: pendingSelection.value.end_offset,
    text: pendingSelection.value.text,
    color,
    note: showNoteInput.value && noteText.value.trim() ? noteText.value.trim() : null,
    ...(props.highlightPathname ? { pathname: props.highlightPathname } : {}),
  })

  window.getSelection()?.removeAllRanges()
  closeAllPopups()
}

// ---- Hover Tooltip ----

function onMarkMouseEnter(e: MouseEvent) {
  const mark = (e.target as Element)?.closest('mark[data-highlight-id]')
  if (!mark || !mark.getAttribute('data-highlight-note')) return

  const note = mark.getAttribute('data-highlight-note')!
  const containerRect = containerRef.value!.getBoundingClientRect()
  const markRect = mark.getBoundingClientRect()

  tooltipNote.value = note
  tooltipPos.value = {
    x: markRect.left - containerRect.left + markRect.width / 2,
    y: markRect.top - containerRect.top - 8,
  }
  showTooltip.value = true
}

function onMarkMouseLeave(e: MouseEvent) {
  const related = e.relatedTarget as Element | null
  if (related?.closest('.hl-tooltip')) return
  showTooltip.value = false
}

// ---- Click Menu ----

function onMarkClick(e: MouseEvent) {
  const mark = (e.target as Element)?.closest('mark[data-highlight-id]') as HTMLElement | null
  if (!mark) return

  e.preventDefault()
  e.stopPropagation()

  const id = parseInt(mark.dataset.highlightId!, 10)
  const hl = myHighlights.value.find(h => h.id === id)
  if (!hl) return

  const containerRect = containerRef.value!.getBoundingClientRect()
  const markRect = mark.getBoundingClientRect()

  menuHighlightId.value = id
  menuPos.value = {
    x: markRect.left - containerRect.left + markRect.width / 2,
    y: markRect.bottom - containerRect.top + 4,
  }
  menuEditNote.value = false
  menuNoteText.value = hl.note || ''
  showMenu.value = true
  showToolbar.value = false
  showTooltip.value = false
}

async function menuChangeColor(color: HighlightColor) {
  if (menuHighlightId.value == null) return
  await highlightStore.update(menuHighlightId.value, { color })
  showMenu.value = false
}

async function menuSaveNote() {
  if (menuHighlightId.value == null) return
  await highlightStore.update(menuHighlightId.value, {
    note: menuNoteText.value.trim() || null,
  })
  menuEditNote.value = false
  showMenu.value = false
}

async function menuDelete() {
  if (menuHighlightId.value == null) return
  await highlightStore.remove(menuHighlightId.value)
  showMenu.value = false
}

// ---- KaTeX Copy ----

const showToast = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | null = null

function onKatexClick(e: MouseEvent) {
  const target = e.target as Element
  // Find the closest .katex element (covers both inline and display math)
  const katexEl = target.closest('.katex')
  if (!katexEl) return

  // Don't copy if user is selecting text (highlight flow)
  const selection = window.getSelection()
  if (selection && !selection.isCollapsed) return

  // Extract LaTeX source from the <annotation> element KaTeX generates
  const annotation = katexEl.querySelector('annotation[encoding="application/x-tex"]')
  if (!annotation?.textContent) return

  const latex = annotation.textContent
  navigator.clipboard.writeText(latex).then(() => {
    if (toastTimer) clearTimeout(toastTimer)
    showToast.value = true
    toastTimer = setTimeout(() => { showToast.value = false }, 2000)
  })
}

// ---- Helpers ----

function closeAllPopups() {
  showToolbar.value = false
  showTooltip.value = false
  showMenu.value = false
  pendingSelection.value = null
}

function onDocumentMouseDown(e: MouseEvent) {
  const target = e.target as Element
  if (target?.closest('.hl-toolbar, .hl-menu, .hl-tooltip')) return
  if (target?.closest('mark[data-highlight-id]')) return
  closeAllPopups()
}

const COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink']
const COLOR_LABELS: Record<HighlightColor, string> = { yellow: '黄', green: '绿', blue: '蓝', pink: '粉' }
</script>

<template>
  <div class="markdown-content max-w-none relative" style="position: relative;">
    <div
      ref="containerRef"
      @mouseup="onMouseUp"
      @mouseover="onMarkMouseEnter"
      @mouseout="onMarkMouseLeave"
      @click="onMarkClick($event); onKatexClick($event)"
    />

    <!-- Selection Toolbar -->
    <div
      v-if="showToolbar"
      class="hl-toolbar"
      :style="{ left: toolbarPos.x + 'px', top: toolbarPos.y + 'px' }"
    >
      <div class="hl-toolbar-colors">
        <button
          v-for="c in COLORS" :key="c"
          class="hl-color-btn"
          :class="'hl-btn-' + c"
          :title="COLOR_LABELS[c]"
          @click.stop="createHighlight(c)"
        />
      </div>
      <button class="hl-note-toggle" @click.stop="showNoteInput = !showNoteInput" title="添加笔记">
        📝
      </button>
      <div v-if="showNoteInput" class="hl-note-input" @click.stop>
        <input
          v-model="noteText"
          placeholder="添加笔记..."
          @keydown.enter.stop="createHighlight('yellow')"
        />
      </div>
    </div>

    <!-- Hover Tooltip -->
    <div
      v-if="showTooltip"
      class="hl-tooltip"
      :style="{ left: tooltipPos.x + 'px', top: tooltipPos.y + 'px' }"
    >
      {{ tooltipNote }}
    </div>

    <!-- Click Menu -->
    <div
      v-if="showMenu"
      class="hl-menu"
      :style="{ left: menuPos.x + 'px', top: menuPos.y + 'px' }"
      @click.stop
    >
      <div class="hl-menu-colors">
        <button
          v-for="c in COLORS" :key="c"
          class="hl-color-btn"
          :class="'hl-btn-' + c"
          :title="COLOR_LABELS[c]"
          @click.stop="menuChangeColor(c)"
        />
      </div>
      <div class="hl-menu-actions">
        <button v-if="!menuEditNote" @click.stop="menuEditNote = true" class="hl-menu-btn">📝 笔记</button>
        <button @click.stop="menuDelete" class="hl-menu-btn hl-menu-btn-danger">🗑 删除</button>
      </div>
      <div v-if="menuEditNote" class="hl-menu-note">
        <input
          v-model="menuNoteText"
          placeholder="添加笔记..."
          @keydown.enter.stop="menuSaveNote"
        />
        <button @click.stop="menuSaveNote" class="hl-menu-btn">保存</button>
      </div>
    </div>

    <!-- Toast -->
    <Teleport to="body">
      <Transition name="toast-fade">
        <div v-if="showToast" class="katex-copy-toast">
          LaTeX 已复制到剪贴板
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* --- Markdown styles --- */
.markdown-content :deep(h1) { font-size: 1.25em; font-weight: 700; margin: 1em 0 0.5em; }
.markdown-content :deep(h2) { font-size: 1.125em; font-weight: 600; margin: 0.8em 0 0.4em; }
.markdown-content :deep(h3) { font-size: 1em; font-weight: 600; margin: 0.6em 0 0.3em; }
.markdown-content :deep(p) { margin: 0.4em 0; line-height: 1.7; }
.markdown-content :deep(ul) { margin: 0.4em 0; padding-left: 1.5em; list-style-type: disc; }
.markdown-content :deep(ol) { margin: 0.4em 0; padding-left: 1.5em; list-style-type: decimal; }
.markdown-content :deep(li) { margin: 0.2em 0; line-height: 1.6; }
.markdown-content :deep(code) {
  background: #f3f4f6; border-radius: 0.25rem; padding: 0.15em 0.35em;
  font-size: 0.85em; color: #374151;
}
.markdown-content :deep(pre) {
  background: #1f2937; color: #e5e7eb; border-radius: 0.5rem;
  padding: 0.75em 1em; overflow-x: auto; margin: 0.5em 0;
}
.markdown-content :deep(pre code) {
  background: none; padding: 0; color: inherit; font-size: 0.85em;
}
.markdown-content :deep(blockquote) {
  border-left: 3px solid #d1d5db; padding-left: 0.75em; margin: 0.5em 0;
  color: #6b7280;
}
.markdown-content :deep(table) { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
.markdown-content :deep(th), .markdown-content :deep(td) {
  border: 1px solid #e5e7eb; padding: 0.4em 0.6em; text-align: left; font-size: 0.85em;
}
.markdown-content :deep(th) { background: #f9fafb; font-weight: 600; }
.markdown-content :deep(strong) { font-weight: 600; }
.markdown-content :deep(a) { color: #4f46e5; text-decoration: underline; }
.markdown-content :deep(hr) { border: none; border-top: 1px solid #e5e7eb; margin: 0.75em 0; }
/* KaTeX display math: center and handle overflow */
.markdown-content :deep(.katex-display) {
  text-align: center; margin: 0.5em 0; overflow-x: auto; overflow-y: hidden;
}
.markdown-content :deep(.katex-display > .katex) { text-align: center; }
/* KaTeX click-to-copy cursor & hover */
.markdown-content :deep(.katex) { cursor: pointer; border-radius: 6px; transition: background-color 0.15s; padding: 1px 3px; }
.markdown-content :deep(.katex:hover) { background-color: rgba(99, 102, 241, 0.08); }

/* --- Highlight colors --- */
.markdown-content :deep(.hl-yellow) { background-color: rgba(250, 204, 21, 0.35); border-radius: 2px; cursor: pointer; }
.markdown-content :deep(.hl-green) { background-color: rgba(74, 222, 128, 0.35); border-radius: 2px; cursor: pointer; }
.markdown-content :deep(.hl-blue) { background-color: rgba(96, 165, 250, 0.35); border-radius: 2px; cursor: pointer; }
.markdown-content :deep(.hl-pink) { background-color: rgba(244, 114, 182, 0.35); border-radius: 2px; cursor: pointer; }

/* --- Toolbar --- */
.hl-toolbar {
  position: absolute; z-index: 50; transform: translateX(-50%);
  display: flex; align-items: center; gap: 4px;
  background: white; border: 1px solid #e5e7eb; border-radius: 8px;
  padding: 4px 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  flex-wrap: wrap;
}
.hl-toolbar-colors { display: flex; gap: 4px; }
.hl-color-btn {
  width: 20px; height: 20px; border-radius: 50%; border: 2px solid transparent;
  cursor: pointer; transition: transform 0.1s;
}
.hl-color-btn:hover { transform: scale(1.2); border-color: #6b7280; }
.hl-btn-yellow { background: rgba(250, 204, 21, 0.7); }
.hl-btn-green { background: rgba(74, 222, 128, 0.7); }
.hl-btn-blue { background: rgba(96, 165, 250, 0.7); }
.hl-btn-pink { background: rgba(244, 114, 182, 0.7); }
.hl-note-toggle {
  background: none; border: none; cursor: pointer; font-size: 14px;
  padding: 2px 4px; border-radius: 4px;
}
.hl-note-toggle:hover { background: #f3f4f6; }
.hl-note-input {
  width: 100%; margin-top: 4px;
}
.hl-note-input input {
  width: 100%; padding: 4px 8px; font-size: 12px;
  border: 1px solid #d1d5db; border-radius: 4px; outline: none;
}
.hl-note-input input:focus { border-color: #6366f1; }

/* --- Tooltip --- */
.hl-tooltip {
  position: absolute; z-index: 50; transform: translateX(-50%) translateY(-100%);
  background: #1f2937; color: white; font-size: 12px; line-height: 1.4;
  padding: 4px 8px; border-radius: 4px; max-width: 250px;
  pointer-events: none; white-space: pre-wrap;
}
.hl-tooltip::after {
  content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
  border: 4px solid transparent; border-top-color: #1f2937;
}

/* --- Click Menu --- */
.hl-menu {
  position: absolute; z-index: 50; transform: translateX(-50%);
  background: white; border: 1px solid #e5e7eb; border-radius: 8px;
  padding: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  min-width: 160px;
}
.hl-menu-colors { display: flex; gap: 4px; margin-bottom: 6px; justify-content: center; }
.hl-menu-actions { display: flex; gap: 4px; }
.hl-menu-btn {
  flex: 1; padding: 4px 8px; font-size: 12px; border: 1px solid #e5e7eb;
  border-radius: 4px; background: white; cursor: pointer;
}
.hl-menu-btn:hover { background: #f3f4f6; }
.hl-menu-btn-danger { color: #ef4444; }
.hl-menu-btn-danger:hover { background: #fef2f2; }
.hl-menu-note { margin-top: 6px; display: flex; gap: 4px; }
.hl-menu-note input {
  flex: 1; padding: 4px 8px; font-size: 12px;
  border: 1px solid #d1d5db; border-radius: 4px; outline: none;
}
.hl-menu-note input:focus { border-color: #6366f1; }
</style>

<style>
/* Toast — teleported to body, must be global */
.katex-copy-toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: #1f2937; color: white; font-size: 14px;
  padding: 8px 20px; border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  z-index: 9999; pointer-events: none;
}
.toast-fade-enter-active { transition: opacity 0.2s, transform 0.2s; }
.toast-fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.toast-fade-enter-from { opacity: 0; transform: translateX(-50%) translateY(8px); }
.toast-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(8px); }
</style>
