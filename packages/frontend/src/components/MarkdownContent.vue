<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount, computed } from 'vue'
import MarkdownIt from 'markdown-it'
import mk from '@traptitech/markdown-it-katex'
import SparkMD5 from 'spark-md5'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import 'katex/dist/katex.min.css'
import { toast } from 'vue-sonner'
import { useRouter, useRoute } from 'vue-router'
import { Trash2, Link2 } from '@lucide/vue'
import { useHighlightStore } from '@/stores/highlights'
import { useAuthStore } from '@/stores/auth'
import { applyHighlights, clearHighlights, getSelectionOffsets } from '@/composables/useHighlight'
import { useBlockAnchor, type AnchorRange } from '@/composables/useBlockAnchor'
import type { HighlightColor } from '@paperland/shared'

const props = defineProps<{ content: string; highlightPathname?: string; paperId?: number }>()

const highlightStore = useHighlightStore()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { locateBlock } = useBlockAnchor()
const containerRef = ref<HTMLElement | null>(null)

// Touch device detection (same approach as QAPanelNav.vue)
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

// Toolbar state
const showToolbar = ref(false)
const toolbarPos = ref({ x: 0, y: 0 })
const pendingSelection = ref<{ start_offset: number; end_offset: number; text: string } | null>(null)

// Click menu state
const showMenu = ref(false)
const menuPos = ref({ x: 0, y: 0 })
const menuHighlightId = ref<number | null>(null)

// Configure markdown-it once
const md = new MarkdownIt({ breaks: true, linkify: true, html: false })
md.use(mk, { throwOnError: false })

// HTML → Markdown converter for the "copy as anchor" action (GFM tables/strikethrough).
const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' })
turndown.use(gfm)

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

// ---- Selection & Toolbar (selectionchange-based) ----

let selectionDebounceTimer: ReturnType<typeof setTimeout> | null = null

function onSelectionChange() {
  // Debounce: shorter for desktop, longer for mobile (touch selection is slower)
  const delay = isTouchDevice ? 300 : 50

  if (selectionDebounceTimer) clearTimeout(selectionDebounceTimer)
  selectionDebounceTimer = setTimeout(() => {
    handleSelectionSettled()
  }, delay)
}

function handleSelectionSettled() {
  const el = containerRef.value
  if (!el) return

  // Highlighting is a logged-in feature; never show the toolbar for anonymous users.
  if (!auth.isAuthenticated) return

  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    // Selection cleared — hide toolbar if showing
    if (showToolbar.value) {
      showToolbar.value = false
      pendingSelection.value = null
    }
    return
  }

  // Check if selection is within our container
  const range = selection.getRangeAt(0)
  if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return

  // Don't show toolbar if selection is inside toolbar/menu elements
  const anchorEl = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer as Element
    : range.startContainer.parentElement
  if (anchorEl?.closest('.hl-toolbar, .hl-menu')) return

  if (!props.content) {
    alert('内容为空，无法创建高亮。请检查组件是否正确接收了内容数据。')
    return
  }

  const offsets = getSelectionOffsets(el)
  if (!offsets) {
    showToolbar.value = false
    return
  }

  pendingSelection.value = offsets

  // Position toolbar below selection with viewport clamping
  const containerRect = el.getBoundingClientRect()
  const rangeRect = range.getBoundingClientRect()

  let x = rangeRect.left + rangeRect.width / 2 - containerRect.left
  const y = rangeRect.bottom - containerRect.top + 6

  // Clamp x so toolbar doesn't overflow container edges
  // Toolbar is ~140px wide (centered via translateX(-50%)), so half-width ~70px
  const toolbarHalfWidth = 70
  const minX = toolbarHalfWidth
  const maxX = containerRect.width - toolbarHalfWidth
  if (maxX > minX) {
    x = Math.max(minX, Math.min(maxX, x))
  }

  toolbarPos.value = { x, y }
  showToolbar.value = true
}

async function createHighlight(color: HighlightColor) {
  if (!pendingSelection.value || !contentHash.value) return

  await highlightStore.create({
    content_hash: contentHash.value,
    start_offset: pendingSelection.value.start_offset,
    end_offset: pendingSelection.value.end_offset,
    text: pendingSelection.value.text,
    color,
    ...(props.highlightPathname ? { pathname: props.highlightPathname } : {}),
  })

  window.getSelection()?.removeAllRanges()
  closeAllPopups()
}

// ---- paperland:// anchor links ----

/** Parse `paperland://paper/<id>?h=<hash>&s=<start>&e=<end>` (h/s/e all optional). */
function parsePaperlandUrl(href: string): { paperId: number; hash: string | null; range: AnchorRange | null } | null {
  const m = href.match(/^paperland:\/\/paper\/(\d+)(?:\?(.*))?$/)
  if (!m) return null
  const params = new URLSearchParams(m[2] || '')
  const s = params.get('s')
  const e = params.get('e')
  return {
    paperId: parseInt(m[1], 10),
    hash: params.get('h'),
    range: s != null && e != null ? { start: parseInt(s, 10), end: parseInt(e, 10) } : null,
  }
}

/** Intercept clicks on `paperland://` links: jump in-app instead of navigating the browser. */
function onAnchorLinkClick(e: MouseEvent | Event) {
  const a = (e.target as Element)?.closest('a[href^="paperland://"]') as HTMLAnchorElement | null
  if (!a) return
  e.preventDefault()
  e.stopPropagation()
  const target = parsePaperlandUrl(a.getAttribute('href') || '')
  if (!target) return
  const onSamePaper = route.name === 'paper-detail' && parseInt(route.params.id as string, 10) === target.paperId
  if (onSamePaper) {
    locateBlock(target.paperId, target.hash, target.range)
  } else {
    const query: Record<string, string> = {}
    if (target.hash) query.h = target.hash
    if (target.range) { query.s = String(target.range.start); query.e = String(target.range.end) }
    router.push({ path: `/papers/${target.paperId}`, query })
  }
}

// Private-use-area chars wrap math sentinels so Turndown never escapes the LaTeX.
const MATH_SENTINEL = ''

/**
 * Convert the live selection back to Markdown.
 * Math (`.katex` / `.katex-display`) is reconstructed exactly from each element's
 * `x-tex` annotation and re-inserted as `$…$` / `$$…$$` AFTER Turndown runs, so the
 * LaTeX is never mangled by Markdown escaping. Tables become GFM pipe tables.
 */
function selectionToMarkdown(): string {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return ''

  const wrapper = document.createElement('div')
  wrapper.appendChild(selection.getRangeAt(0).cloneContents())

  // Drop highlight <mark> wrappers so highlight styling doesn't leak into the Markdown.
  for (const mark of Array.from(wrapper.querySelectorAll('mark[data-highlight-id]'))) {
    const parent = mark.parentNode
    if (!parent) continue
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
  }

  // Swap each KaTeX element for a sentinel text node (display before inline, since
  // `.katex-display` contains a `.katex`). Record the original LaTeX for re-insertion.
  const maths: { display: boolean; tex: string }[] = []
  const swapKatex = (selector: string, display: boolean) => {
    for (const el of Array.from(wrapper.querySelectorAll(selector))) {
      const tex = (el.querySelector('annotation[encoding="application/x-tex"]')?.textContent || '').trim()
      el.replaceWith(document.createTextNode(`${MATH_SENTINEL}${maths.length}${MATH_SENTINEL}`))
      maths.push({ display, tex })
    }
  }
  swapKatex('.katex-display', true)
  swapKatex('.katex', false)

  let markdown = turndown.turndown(wrapper.innerHTML)
  markdown = markdown.replace(
    new RegExp(`${MATH_SENTINEL}(\\d+)${MATH_SENTINEL}`, 'g'),
    (_, i) => {
      const m = maths[Number(i)]
      if (!m) return ''
      // Display math must sit on its own line(s) to parse as a block; inline math is left in place.
      return m.display ? `\n$$\n${m.tex}\n$$\n` : `$${m.tex}$`
    },
  )
  // The sentinel usually already sits in its own paragraph, so the newlines added around
  // display math would otherwise double up the blank line — collapse 3+ newlines to one blank line.
  markdown = markdown.replace(/\n{3,}/g, '\n\n')
  return markdown.trim()
}

/** Copy the full selection as Markdown, followed by a compact `[#](paperland://…)` anchor. */
function copyAnchorLink() {
  if (!pendingSelection.value || !contentHash.value || !props.paperId) return
  const { start_offset, end_offset, text } = pendingSelection.value
  const url = `paperland://paper/${props.paperId}?h=${contentHash.value}&s=${start_offset}&e=${end_offset}`
  // Fall back to the rendered plain text if Markdown conversion comes back empty
  // (e.g. the browser collapsed the selection when the toolbar was tapped).
  const content = selectionToMarkdown() || text.trim()
  navigator.clipboard.writeText(`${content} [#](${url})`)
  toast.success('已复制内容和锚点链接', { position: 'bottom-center' })
  window.getSelection()?.removeAllRanges()
  closeAllPopups()
}

// ---- Click Menu ----

function onMarkClick(e: MouseEvent | Event) {
  const mark = (e.target as Element)?.closest('mark[data-highlight-id]') as HTMLElement | null
  if (!mark) return

  // On touch devices, don't open menu if there's an active text selection (let toolbar handle it)
  if (isTouchDevice) {
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed) return
  }

  e.preventDefault()
  e.stopPropagation()

  const id = parseInt(mark.dataset.highlightId!, 10)
  const hl = myHighlights.value.find(h => h.id === id)
  if (!hl) return

  const containerRect = containerRef.value!.getBoundingClientRect()
  const markRect = mark.getBoundingClientRect()

  menuHighlightId.value = id

  // Position menu with viewport clamping
  let x = markRect.left - containerRect.left + markRect.width / 2
  const y = markRect.bottom - containerRect.top + 4

  const menuHalfWidth = 80
  const minX = menuHalfWidth
  const maxX = containerRect.width - menuHalfWidth
  if (maxX > minX) {
    x = Math.max(minX, Math.min(maxX, x))
  }

  menuPos.value = { x, y }
  showMenu.value = true
  showToolbar.value = false
}

async function menuChangeColor(color: HighlightColor) {
  if (menuHighlightId.value == null) return
  await highlightStore.update(menuHighlightId.value, { color })
  showMenu.value = false
}

async function menuDelete() {
  if (menuHighlightId.value == null) return
  await highlightStore.remove(menuHighlightId.value)
  showMenu.value = false
}

// ---- KaTeX Copy ----

function onKatexClick(e: MouseEvent | Event) {
  const target = e.target as Element
  const katexEl = target.closest('.katex')
  if (!katexEl) return

  const selection = window.getSelection()
  if (selection && !selection.isCollapsed) return

  const annotation = katexEl.querySelector('annotation[encoding="application/x-tex"]')
  if (!annotation?.textContent) return

  navigator.clipboard.writeText(annotation.textContent).then(() => {
    toast.success('LaTeX 已复制到剪贴板', { position: 'bottom-center' })
  })
}

// ---- Helpers ----

function closeAllPopups() {
  showToolbar.value = false
  showMenu.value = false
  pendingSelection.value = null
}

/** Dismiss popups on outside click/tap — idempotent, safe for both mousedown & touchstart */
function onDocumentDismiss(e: MouseEvent | TouchEvent) {
  const target = e.target as Element
  if (target?.closest('.hl-toolbar, .hl-menu')) return
  if (target?.closest('mark[data-highlight-id]')) return
  closeAllPopups()
}

const COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink']
const COLOR_LABELS: Record<HighlightColor, string> = { yellow: 'Yellow', green: 'Green', blue: 'Blue', pink: 'Pink' }

// ---- Lifecycle ----

onMounted(() => {
  renderAndHighlight()
  // Selection detection via selectionchange (works on both desktop and mobile)
  document.addEventListener('selectionchange', onSelectionChange)
  // Popup dismissal — both mouse and touch
  document.addEventListener('mousedown', onDocumentDismiss)
  document.addEventListener('touchstart', onDocumentDismiss, { passive: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', onSelectionChange)
  document.removeEventListener('mousedown', onDocumentDismiss)
  document.removeEventListener('touchstart', onDocumentDismiss)
  if (selectionDebounceTimer) clearTimeout(selectionDebounceTimer)
})
</script>

<template>
  <div class="markdown-content max-w-none relative" style="position: relative;" :data-content-hash="contentHash">
    <div
      ref="containerRef"
      @click="onAnchorLinkClick($event); onMarkClick($event); onKatexClick($event)"
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
      <button v-if="paperId" class="hl-note-toggle" @click.stop="copyAnchorLink" title="复制内容和锚点链接">
        <Link2 class="hl-icon" />
      </button>
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
        <button @click.stop="menuDelete" class="hl-menu-btn hl-menu-btn-danger">
          <Trash2 class="hl-icon" /> Delete
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* --- Markdown styles --- */
/* Break long unbreakable tokens (URLs, identifiers) so prose never forces the
   article wider than its container — the main cause of mobile horizontal scroll.
   overflow-wrap is inherited, so this covers p / li / headings too. Code blocks
   (<pre>) keep white-space:pre + their own overflow-x:auto and are unaffected. */
.markdown-content { overflow-wrap: anywhere; }
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
  overflow-wrap: anywhere; word-break: break-word;
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
.markdown-content :deep(a) { color: var(--primary); text-decoration: underline; word-break: break-all; }
.markdown-content :deep(hr) { border: none; border-top: 1px solid #e5e7eb; margin: 0.75em 0; }
/* KaTeX display math: center and handle overflow */
.markdown-content :deep(.katex-display) {
  text-align: center; margin: 0.5em 0; overflow-x: auto; overflow-y: hidden;
}
.markdown-content :deep(.katex-display > .katex) { text-align: center; }
/* KaTeX click-to-copy cursor & hover */
.markdown-content :deep(.katex) { cursor: pointer; border-radius: 6px; transition: background-color 0.15s; padding: 1px 3px; }
.markdown-content :deep(.katex:hover) { background-color: color-mix(in oklch, var(--primary) 12%, transparent); }

/* --- Highlight colors --- */
.markdown-content :deep(.hl-yellow) { background-color: rgba(250, 204, 21, 0.35); border-radius: 2px; cursor: pointer; }
.markdown-content :deep(.hl-green) { background-color: rgba(74, 222, 128, 0.35); border-radius: 2px; cursor: pointer; }
.markdown-content :deep(.hl-blue) { background-color: rgba(96, 165, 250, 0.35); border-radius: 2px; cursor: pointer; }
.markdown-content :deep(.hl-pink) { background-color: rgba(244, 114, 182, 0.35); border-radius: 2px; cursor: pointer; }

/* --- Shared icon size for buttons in toolbar / menu --- */
.hl-icon {
  width: 14px; height: 14px; display: inline-block; vertical-align: -2px;
}

/* --- Toolbar --- */
.hl-toolbar {
  position: absolute; z-index: 50; transform: translateX(-50%);
  display: flex; align-items: center; gap: 4px;
  background: var(--popover); color: var(--popover-foreground);
  border: 1px solid var(--border); border-radius: calc(var(--radius) + 2px);
  padding: 4px 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  flex-wrap: wrap; user-select: none; -webkit-user-select: none;
}
.hl-toolbar-colors { display: flex; gap: 4px; }
.hl-color-btn {
  width: 20px; height: 20px; border-radius: 50%; border: 2px solid transparent;
  cursor: pointer; transition: transform 0.1s;
}
.hl-color-btn:hover { transform: scale(1.2); border-color: var(--muted-foreground); }
.hl-btn-yellow { background: rgba(250, 204, 21, 0.7); }
.hl-btn-green { background: rgba(74, 222, 128, 0.7); }
.hl-btn-blue { background: rgba(96, 165, 250, 0.7); }
.hl-btn-pink { background: rgba(244, 114, 182, 0.7); }
.hl-note-toggle {
  background: none; border: none; cursor: pointer;
  color: var(--popover-foreground);
  padding: 4px; border-radius: var(--radius-sm);
  display: inline-flex; align-items: center; justify-content: center;
}
.hl-note-toggle:hover { background: var(--accent); color: var(--accent-foreground); }

/* --- Click Menu --- */
.hl-menu {
  position: absolute; z-index: 50; transform: translateX(-50%);
  background: var(--popover); color: var(--popover-foreground);
  border: 1px solid var(--border); border-radius: calc(var(--radius) + 2px);
  padding: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  min-width: 160px; user-select: none; -webkit-user-select: none;
}
.hl-menu-colors { display: flex; gap: 4px; margin-bottom: 6px; justify-content: center; }
.hl-menu-actions { display: flex; gap: 4px; }
.hl-menu-btn {
  flex: 1; padding: 4px 8px; font-size: 12px;
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  background: var(--background); color: var(--foreground);
  border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer;
}
.hl-menu-btn:hover { background: var(--accent); color: var(--accent-foreground); }
.hl-menu-btn-danger { color: var(--destructive); }
.hl-menu-btn-danger:hover { background: color-mix(in oklch, var(--destructive) 12%, transparent); color: var(--destructive); }
</style>

