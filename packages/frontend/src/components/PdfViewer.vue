<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { FileText, ChevronUp, ChevronDown, ZoomIn, ZoomOut, Link2, Loader2, AlertTriangle, MoveHorizontal, MoveVertical, Crop } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { loadPdfjs } from '@/lib/pdfjs'
import { buildTextSegments, getSelectionOffsets } from '@/composables/useHighlight'
import { requestedPdfTarget, type PdfNavTarget } from '@/composables/usePdfNavigation'
import { useThemeStore } from '@/stores/theme'
import { configApi } from '@/api/client'
import { uploadImage } from '@/utils/uploadImage'
import 'pdfjs-dist/web/pdf_viewer.css'

const props = defineProps<{ pdfPath: string | null; paperId?: number | null }>()

const rawUrl = computed(() => (props.pdfPath ? `/api/files/${encodeURIComponent(props.pdfPath)}` : null))

const theme = useThemeStore()
// Dark-mode PDF page colors (gray background, near-white text). Passed to pdf.js as
// `pageColors`, which recolors inside the canvas raster. Keep the gray in sync with the
// `.pdf-page` dark background in <style> so the loading gutter matches the page.
const DARK_PAGE_COLORS = { background: '#3a3a3a', foreground: '#e8e8e8' }

// ---- Document & page state ----
// pdf.js objects are intentionally non-reactive (Vue should not proxy them).
let pdfjs: Awaited<ReturnType<typeof loadPdfjs>> | null = null
let pdfDoc: any = null
let loadingTask: any = null

const loading = ref(true)
const error = ref(false)
const numPages = ref(0)
const currentPage = ref(1)
/** Per-page placeholder size in PDF points (scale 1); CSS size = wPt * effectiveScale. */
const pages = ref<{ num: number; wPt: number; hPt: number }[]>([])

const viewerRef = ref<HTMLElement | null>(null)

// ---- Scale: effectiveScale = fitScale (fit width) * zoom ----
const fitScale = ref(1)
const zoom = ref(1)
// Fit-to-width (default) vs fit-to-height. Per-session only — resets when the viewer remounts.
const fitMode = ref<'width' | 'height'>('width')
const effectiveScale = computed(() => Math.max(0.2, fitScale.value * zoom.value))
const zoomPct = computed(() => Math.round(zoom.value * 100))

const PAGE_PAD = 24 // breathing room around the page when fitting

function updateFit() {
  const root = viewerRef.value
  const first = pages.value[0]
  if (!root || !first || first.wPt <= 0 || first.hPt <= 0) return
  if (fitMode.value === 'height') {
    const avail = root.clientHeight - PAGE_PAD
    if (avail > 0) fitScale.value = avail / first.hPt
  } else {
    const avail = root.clientWidth - PAGE_PAD
    if (avail > 0) fitScale.value = avail / first.wPt
  }
}

/** Toggle fit-to-width ↔ fit-to-height (resets zoom so the new fit is exact). */
function toggleFitMode() {
  fitMode.value = fitMode.value === 'width' ? 'height' : 'width'
  zoom.value = 1
  updateFit()
}

// ---- Rendering (lazy, scale-aware) ----
const rendered = new Map<number, { scale: number; dark: boolean; canvas: HTMLCanvasElement; textLayer: HTMLElement }>()
const renderTasks = new Map<number, { task: any; scale: number; dark: boolean }>()

function pageEl(num: number): HTMLElement | null {
  return viewerRef.value?.querySelector<HTMLElement>(`[data-pdf-page="${num}"]`) ?? null
}

async function renderPage(num: number) {
  const el = pageEl(num)
  if (!el || !pdfjs || !pdfDoc) return
  const sc = effectiveScale.value
  const dark = theme.resolved === 'dark'
  const ex = rendered.get(num)
  // Already rendered at this scale AND theme — nothing to do.
  if (ex && ex.scale === sc && ex.dark === dark) return
  // A render at this exact scale+theme is already in flight.
  const inflight = renderTasks.get(num)
  if (inflight && inflight.scale === sc && inflight.dark === dark) return
  inflight?.task?.cancel?.()

  let renderTask: any = null
  try {
    const page = await pdfDoc.getPage(num)
    const viewport = page.getViewport({ scale: sc })

    // Correct the placeholder from the page's true size (papers are usually uniform).
    const p = pages.value.find((q) => q.num === num)
    if (p) { p.wPt = viewport.width / sc; p.hPt = viewport.height / sc }

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    // Render into a FRESH, off-DOM canvas. pdf.js fills the canvas white at the start of every
    // render and only applies the dark `pageColors` (HCM) filter at the very end; if the canvas
    // were already live in the DOM the browser would paint that white-then-dark transition as a
    // flash. By rendering off-DOM and swapping the finished (already-dark) canvas in afterwards,
    // no intermediate frame is ever shown. The previous canvas stays visible until the swap, so
    // theme toggles and zoom re-rasters never blank or flash either.
    const canvas = document.createElement('canvas')
    canvas.className = 'pdf-canvas'
    canvas.width = Math.floor(viewport.width * dpr)
    canvas.height = Math.floor(viewport.height * dpr)

    renderTask = page.render({
      canvas,
      viewport,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      pageColors: dark ? DARK_PAGE_COLORS : undefined,
    })
    renderTasks.set(num, { task: renderTask, scale: sc, dark })
    await renderTask.promise

    // Swap the finished canvas in, replacing the previous one (or appending on first render).
    if (ex?.canvas && ex.canvas.parentNode) ex.canvas.replaceWith(canvas)
    else el.appendChild(canvas)

    // Text layer (selectable, transparent overlay aligned to the canvas).
    const textLayer = ex?.textLayer ?? document.createElement('div')
    if (!ex?.textLayer) { textLayer.className = 'textLayer'; el.appendChild(textLayer) }
    textLayer.replaceChildren()
    textLayer.style.setProperty('--scale-factor', String(sc))
    textLayer.style.width = `${viewport.width}px`
    textLayer.style.height = `${viewport.height}px`
    const textContent = await page.getTextContent()
    await new pdfjs.TextLayer({ textContentSource: textContent, container: textLayer, viewport }).render()

    rendered.set(num, { scale: sc, dark, canvas, textLayer })
  } catch {
    // RenderingCancelledException (zoom/scroll/theme churn) — ignore; a later pass re-renders.
  } finally {
    // Only clear if this very task is still the registered one (a newer render may have replaced it).
    if (renderTasks.get(num)?.task === renderTask) renderTasks.delete(num)
  }
}

function unrenderPage(num: number) {
  renderTasks.get(num)?.task?.cancel?.()
  renderTasks.delete(num)
  const ex = rendered.get(num)
  if (ex) { ex.canvas.remove(); ex.textLayer.remove(); rendered.delete(num) }
}

/** Force a page to be rendered at the current scale and wait until its text layer exists. */
async function ensurePageRendered(num: number) {
  void renderPage(num)
  const start = performance.now()
  while (rendered.get(num)?.scale !== effectiveScale.value) {
    if (performance.now() - start > 4000) break
    await new Promise((r) => requestAnimationFrame(r))
  }
}

// ---- IntersectionObserver: render near viewport, unrender when far ----
let io: IntersectionObserver | null = null

function setupObserver() {
  io?.disconnect()
  if (!viewerRef.value) return
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const num = Number((e.target as HTMLElement).dataset.pdfPage)
        if (!num) continue
        if (e.isIntersecting) renderPage(num)
        else unrenderPage(num)
      }
    },
    { root: viewerRef.value, rootMargin: '200% 0px' },
  )
  for (const el of viewerRef.value.querySelectorAll('.pdf-page')) io.observe(el)
}

// ---- Current page tracking (most-visible page) ----
let scrollRaf = 0
function onScroll() {
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    updateCurrentPage()
  })
}

function updateCurrentPage() {
  const root = viewerRef.value
  if (!root) return
  const r = root.getBoundingClientRect()
  const center = r.top + r.height / 2
  for (const p of pages.value) {
    const el = pageEl(p.num)
    if (!el) continue
    const pr = el.getBoundingClientRect()
    if (pr.top <= center && pr.bottom >= center) { currentPage.value = p.num; return }
    if (pr.top > center) { currentPage.value = p.num; return }
  }
  if (pages.value.length) currentPage.value = pages.value[pages.value.length - 1].num
}

// ---- Navigation (scroll + transient region highlight) ----
let pending: PdfNavTarget | null = null

function scrollToPage(num: number) {
  pageEl(num)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Map page-text offsets to client rects via the rendered text layer (reuses highlight segments). */
function offsetsToRects(textLayer: HTMLElement, start: number, end: number): DOMRect[] {
  const segs = buildTextSegments(textLayer)
  if (!segs.length) return []
  const at = (offset: number) => {
    for (const s of segs) if (offset <= s.offset + s.length) return { node: s.node, local: Math.min(s.length, Math.max(0, offset - s.offset)) }
    const last = segs[segs.length - 1]
    return { node: last.node, local: last.length }
  }
  const a = at(start), b = at(end)
  const range = document.createRange()
  try {
    range.setStart(a.node, Math.min(a.local, (a.node.textContent || '').length))
    range.setEnd(b.node, Math.min(b.local, (b.node.textContent || '').length))
  } catch { return [] }
  return Array.from(range.getClientRects())
}

/** Draw a transient (non-persisted) highlight over a page-text offset range. Returns false if not found. */
function highlightRegion(num: number, ts: number, te: number): boolean {
  const ex = rendered.get(num)
  const el = pageEl(num)
  if (!ex || !el) return false
  const rects = offsetsToRects(ex.textLayer, ts, te)
  if (!rects.length) return false
  const pr = el.getBoundingClientRect()
  let first: HTMLElement | null = null
  for (const rc of rects) {
    const d = document.createElement('div')
    d.className = 'pdf-region-flash'
    d.style.left = `${rc.left - pr.left}px`
    d.style.top = `${rc.top - pr.top}px`
    d.style.width = `${rc.width}px`
    d.style.height = `${rc.height}px`
    el.appendChild(d)
    first ??= d
    window.setTimeout(() => d.remove(), 2200)
  }
  first?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return true
}

/** Draw a transient highlight over a normalized `[0,1]` page-space rectangle. Returns false if not renderable. */
function highlightRect(num: number, rect: { x: number; y: number; w: number; h: number }): boolean {
  const el = pageEl(num)
  if (!el || !(rect.w > 0) || !(rect.h > 0)) return false
  const pr = el.getBoundingClientRect()
  const d = document.createElement('div')
  d.className = 'pdf-region-flash'
  d.style.left = `${rect.x * pr.width}px`
  d.style.top = `${rect.y * pr.height}px`
  d.style.width = `${rect.w * pr.width}px`
  d.style.height = `${rect.h * pr.height}px`
  el.appendChild(d)
  window.setTimeout(() => d.remove(), 2200)
  d.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return true
}

async function applyTarget(target: PdfNavTarget | null) {
  if (!target) return
  if (loading.value || !pdfDoc) { pending = target; return }
  const num = Math.min(Math.max(1, Math.round(target.page)), numPages.value || 1)
  await ensurePageRendered(num)
  await nextTick()
  // Rectangle target wins over a text-offset region.
  if (target.rect) {
    if (!highlightRect(num, target.rect)) {
      scrollToPage(num)
      toast.error('Anchor is stale — the region was not found on this page.', { position: 'bottom-center' })
    }
  } else if (target.ts != null && target.te != null) {
    if (!highlightRegion(num, target.ts, target.te)) {
      scrollToPage(num)
      toast.error('Anchor is stale — the selection was not found on this page.', { position: 'bottom-center' })
    }
  } else {
    scrollToPage(num)
  }
  currentPage.value = num
}

// ---- Toolbar actions ----
function goToPage(num: number) {
  const n = Math.min(Math.max(1, Math.round(num)), numPages.value || 1)
  currentPage.value = n
  void ensurePageRendered(n).then(() => scrollToPage(n))
}
function prevPage() { goToPage(currentPage.value - 1) }
function nextPage() { goToPage(currentPage.value + 1) }
function onJumpInput(e: Event) {
  const v = parseInt((e.target as HTMLInputElement).value, 10)
  if (!Number.isNaN(v)) goToPage(v)
}

function zoomIn() { zoom.value = Math.min(3, +(zoom.value * 1.2).toFixed(3)) }
function zoomOut() { zoom.value = Math.max(0.4, +(zoom.value / 1.2).toFixed(3)) }

function copyPageLink() {
  if (!props.paperId) return
  const url = `paperland://paper/${props.paperId}?pdf=${currentPage.value}`
  navigator.clipboard.writeText(`[PDF p.${currentPage.value}](${url})`)
  toast.success('已复制本页链接', { position: 'bottom-center' })
}

// ---- Selection capture → floating "copy selection link" ----
const selRegion = ref<{ page: number; ts: number; te: number; text: string } | null>(null)
const showSelBtn = ref(false)
const selBtnPos = ref({ x: 0, y: 0 })
let selTimer: ReturnType<typeof setTimeout> | null = null

function hideSelBtn() { showSelBtn.value = false; selRegion.value = null }

function onSelectionChange() {
  if (selTimer) clearTimeout(selTimer)
  selTimer = setTimeout(handleSelectionSettled, 60)
}

function handleSelectionSettled() {
  const root = viewerRef.value
  if (!root) return hideSelBtn()
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return hideSelBtn()
  const range = sel.getRangeAt(0)
  const elOf = (n: Node) => (n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement)
  const startPage = elOf(range.startContainer)?.closest('.pdf-page') as HTMLElement | null
  const endPage = elOf(range.endContainer)?.closest('.pdf-page') as HTMLElement | null
  if (!startPage || startPage !== endPage || !root.contains(startPage)) return hideSelBtn()
  const textLayer = startPage.querySelector<HTMLElement>('.textLayer')
  if (!textLayer || !textLayer.contains(range.startContainer) || !textLayer.contains(range.endContainer)) return hideSelBtn()
  const offs = getSelectionOffsets(textLayer)
  if (!offs) return hideSelBtn()
  selRegion.value = {
    page: Number(startPage.dataset.pdfPage),
    ts: offs.start_offset,
    te: offs.end_offset,
    text: offs.text,
  }
  const rr = range.getBoundingClientRect()
  const vr = root.getBoundingClientRect()
  selBtnPos.value = { x: rr.left + rr.width / 2 - vr.left, y: rr.bottom - vr.top + 6 }
  showSelBtn.value = !!props.paperId
}

function copySelectionLink() {
  if (!props.paperId || !selRegion.value) return
  const { page, ts, te, text } = selRegion.value
  const url = `paperland://paper/${props.paperId}?pdf=${page}&ts=${ts}&te=${te}`
  navigator.clipboard.writeText(`${text.trim()} [#](${url})`)
  toast.success('已复制选区链接', { position: 'bottom-center' })
  window.getSelection()?.removeAllRanges()
  hideSelBtn()
}

// ---- Region screenshot: crop a normalized page region to a PNG data URL ----
// Renders ONLY the selected region (not the whole page then crop) so a high-DPI
// capture stays cheap in memory. `scale = dpi / 72` because PDF user-space units are
// 1/72 inch, so scale 1 ≈ 72 DPI. A translation transform shifts the region's top-left
// to the canvas origin so pdf.js paints just that slice.
async function cropRegionToImage(
  region: { page: number; x: number; y: number; w: number; h: number },
  dpi: number,
): Promise<string | null> {
  if (!pdfjs || !pdfDoc) return null
  const page = await pdfDoc.getPage(region.page)
  const scale = Math.max(0.1, dpi / 72)
  const viewport = page.getViewport({ scale })
  const sx = region.x * viewport.width, sy = region.y * viewport.height
  const sw = Math.max(1, region.w * viewport.width), sh = Math.max(1, region.h * viewport.height)
  const out = document.createElement('canvas')
  out.width = Math.round(sw)
  out.height = Math.round(sh)
  await page.render({
    canvas: out,
    viewport,
    // Shift the page so the region's origin lands at (0,0) of the region-sized canvas.
    transform: [1, 0, 0, 1, -sx, -sy],
  }).promise
  return out.toDataURL('image/png')
}
defineExpose({ cropRegionToImage })

// ---- Region capture mode (toolbar "framing screenshot" → image host) ----
// Default DPI comes from config.yml (single source of truth), fetched once on mount;
// 300 is only a fallback if the request fails. Never hardcode the capture quality here.
const screenshotDpi = ref(300)

const captureMode = ref(false)
const capturing = ref(false)
/** Live rubber-band rect in `.pdf-scroll` CONTENT coords (so it scrolls with the pages). */
const dragRect = ref<{ x: number; y: number; w: number; h: number } | null>(null)
// `client` coords drive the region math (robust to scroll); `content` coords (incl. scroll
// offset) drive the rubber-band rendering inside the scroll container.
let dragStart: { clientX: number; clientY: number; contentX: number; contentY: number; pageEl: HTMLElement } | null = null

function toggleCaptureMode() {
  captureMode.value = !captureMode.value
  dragRect.value = null
  dragStart = null
  if (captureMode.value) window.getSelection()?.removeAllRanges()
}

function exitCaptureMode() {
  captureMode.value = false
  dragRect.value = null
  dragStart = null
}

/** Page element under a client point, constrained to this viewer. */
function pageElAtPoint(clientX: number, clientY: number): HTMLElement | null {
  const root = viewerRef.value
  if (!root) return null
  for (const el of root.querySelectorAll<HTMLElement>('.pdf-page')) {
    const r = el.getBoundingClientRect()
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return el
  }
  return null
}

function onCaptureDown(e: MouseEvent) {
  if (!captureMode.value || capturing.value) return
  const pageEl = pageElAtPoint(e.clientX, e.clientY)
  const root = viewerRef.value
  if (!pageEl || !root) return
  e.preventDefault()
  const vr = root.getBoundingClientRect()
  const contentX = e.clientX - vr.left + root.scrollLeft
  const contentY = e.clientY - vr.top + root.scrollTop
  dragStart = { clientX: e.clientX, clientY: e.clientY, contentX, contentY, pageEl }
  dragRect.value = { x: contentX, y: contentY, w: 0, h: 0 }
  window.addEventListener('mousemove', onCaptureMove)
  window.addEventListener('mouseup', onCaptureUp)
}

function onCaptureMove(e: MouseEvent) {
  if (!dragStart || !viewerRef.value) return
  const root = viewerRef.value
  const vr = root.getBoundingClientRect()
  const cx = e.clientX - vr.left + root.scrollLeft
  const cy = e.clientY - vr.top + root.scrollTop
  dragRect.value = {
    x: Math.min(dragStart.contentX, cx),
    y: Math.min(dragStart.contentY, cy),
    w: Math.abs(cx - dragStart.contentX),
    h: Math.abs(cy - dragStart.contentY),
  }
}

async function onCaptureUp(e: MouseEvent) {
  window.removeEventListener('mousemove', onCaptureMove)
  window.removeEventListener('mouseup', onCaptureUp)
  const start = dragStart
  dragStart = null
  dragRect.value = null
  if (!start || !props.paperId) return
  const pageEl = start.pageEl
  const pr = pageEl.getBoundingClientRect()
  // Region math uses client coords (scroll-independent), clamped to the start page.
  const clampedLeft = Math.max(pr.left, Math.min(pr.right, Math.min(start.clientX, e.clientX)))
  const clampedTop = Math.max(pr.top, Math.min(pr.bottom, Math.min(start.clientY, e.clientY)))
  const clampedRight = Math.max(pr.left, Math.min(pr.right, Math.max(start.clientX, e.clientX)))
  const clampedBottom = Math.max(pr.top, Math.min(pr.bottom, Math.max(start.clientY, e.clientY)))
  const localW = clampedRight - clampedLeft, localH = clampedBottom - clampedTop
  if (localW < 4 || localH < 4) return
  // Normalize to [0,1] page space (page rect already reflects effectiveScale).
  const region = {
    page: Number(pageEl.dataset.pdfPage),
    x: (clampedLeft - pr.left) / pr.width,
    y: (clampedTop - pr.top) / pr.height,
    w: localW / pr.width,
    h: localH / pr.height,
  }
  await captureRegion(region)
}

async function captureRegion(region: { page: number; x: number; y: number; w: number; h: number }) {
  if (!props.paperId || capturing.value) return
  capturing.value = true
  try {
    const dataUrl = await cropRegionToImage(region, screenshotDpi.value)
    if (!dataUrl) throw new Error('render failed')
    const blob = await (await fetch(dataUrl)).blob()
    const { url } = await uploadImage(blob, `paper-${props.paperId}-p${region.page}.png`)
    const r4 = (n: number) => Math.round(n * 1e4) / 1e4
    const anchor = `paperland://paper/${props.paperId}?pdf=${region.page}&rx=${r4(region.x)}&ry=${r4(region.y)}&rw=${r4(region.w)}&rh=${r4(region.h)}`
    await navigator.clipboard.writeText(`[![](${url})](${anchor})`)
    toast.success('已复制截图链接', { position: 'bottom-center' })
    exitCaptureMode()
  } catch {
    toast.error('截图上传失败，请重试', { position: 'bottom-center' })
  } finally {
    capturing.value = false
  }
}

function onCaptureKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && captureMode.value) exitCaptureMode()
}

// ---- Lifecycle ----
async function loadDocument() {
  cleanupDoc()
  if (!props.pdfPath) { loading.value = false; return }
  loading.value = true
  error.value = false
  try {
    pdfjs = await loadPdfjs()
    loadingTask = pdfjs.getDocument({ url: `/api/files/${encodeURIComponent(props.pdfPath)}` })
    pdfDoc = await loadingTask.promise
    numPages.value = pdfDoc.numPages
    const first = await pdfDoc.getPage(1)
    const vp1 = first.getViewport({ scale: 1 })
    pages.value = Array.from({ length: numPages.value }, (_, i) => ({ num: i + 1, wPt: vp1.width, hPt: vp1.height }))
    loading.value = false
    await nextTick()
    updateFit()
    setupObserver()
    updateCurrentPage()
    const initial = pending ?? requestedPdfTarget.value
    pending = null
    if (initial) applyTarget(initial)
  } catch {
    error.value = true
    loading.value = false
  }
}

function cleanupDoc() {
  io?.disconnect(); io = null
  for (const { task } of renderTasks.values()) task?.cancel?.()
  renderTasks.clear()
  rendered.clear()
  pages.value = []
  numPages.value = 0
  currentPage.value = 1
  zoom.value = 1
  try { loadingTask?.destroy?.() } catch { /* noop */ }
  try { pdfDoc?.destroy?.() } catch { /* noop */ }
  pdfDoc = null
  loadingTask = null
}

let ro: ResizeObserver | null = null
let resizeRaf = 0
let reRasterTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  loadDocument()
  document.addEventListener('selectionchange', onSelectionChange)
  window.addEventListener('keydown', onCaptureKey)
  // Capture DPI default lives in config.yml; fall back to 300 if the request fails.
  configApi.pdf().then((c) => { if (c?.screenshot_dpi) screenshotDpi.value = c.screenshot_dpi }).catch(() => {})
  ro = new ResizeObserver(() => {
    if (resizeRaf) return
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0
      updateFit()
    })
  })
  if (viewerRef.value) ro.observe(viewerRef.value)
})

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', onSelectionChange)
  window.removeEventListener('keydown', onCaptureKey)
  window.removeEventListener('mousemove', onCaptureMove)
  window.removeEventListener('mouseup', onCaptureUp)
  if (selTimer) clearTimeout(selTimer)
  if (reRasterTimer) clearTimeout(reRasterTimer)
  ro?.disconnect()
  cleanupDoc()
})

// Reload when the PDF path changes (paper → paper navigation reuses this component).
watch(() => props.pdfPath, () => loadDocument())

// Scale changes (zoom / fit-to-width while dragging the split pane) resize the placeholders and
// CSS-scale the existing canvases instantly. Re-rasterizing at the new scale (canvas + text layer)
// is expensive, so debounce it to fire once the scale has settled — never per resize frame.
// A longer wait keeps the drag fully smooth and avoids a premature re-raster on brief pauses;
// the page just stays CSS-scaled (slightly soft) until it lands.
const RE_RASTER_DEBOUNCE_MS = 320
watch(effectiveScale, () => {
  if (reRasterTimer) clearTimeout(reRasterTimer)
  reRasterTimer = setTimeout(async () => {
    await nextTick()
    for (const num of [...rendered.keys()]) renderPage(num)
  }, RE_RASTER_DEBOUNCE_MS)
})

// Theme change: pageColors are baked into the raster, so cached pages can't recolor in place —
// re-render the live (rendered + in-flight) pages with the new colors. renderPage now renders
// off-DOM and swaps on completion, so the old canvas stays visible until the new one is ready
// (no unrender-induced blank, no white flash). Off-screen pages render fresh when scrolled in.
watch(() => theme.resolved, () => {
  const live = new Set<number>([...rendered.keys(), ...renderTasks.keys()])
  for (const num of live) renderPage(num)
})

// React to anchor navigation requests (set on mount via initial, plus subsequent clicks).
watch(requestedPdfTarget, (t) => applyTarget(t))
</script>

<template>
  <div class="pdf-viewer-root">
    <!-- Empty: no PDF yet -->
    <div v-if="!pdfPath" class="pdf-state">
      <FileText class="h-12 w-12 mb-3 stroke-1" />
      <p class="text-sm">暂无 PDF</p>
      <p class="text-xs mt-1">等待 arxiv 服务下载...</p>
    </div>

    <!-- Error: pdf.js failed; offer the raw file -->
    <div v-else-if="error" class="pdf-state">
      <AlertTriangle class="h-12 w-12 mb-3 stroke-1 text-destructive" />
      <p class="text-sm">PDF 加载失败</p>
      <a v-if="rawUrl" :href="rawUrl" target="_blank" rel="noopener" class="text-xs mt-1 text-primary underline">打开原始 PDF</a>
    </div>

    <template v-else>
      <!-- Toolbar -->
      <div class="pdf-toolbar">
        <div class="pdf-tb-group">
          <button class="pdf-tb-btn" title="上一页" @click="prevPage"><ChevronUp class="h-4 w-4" /></button>
          <span class="pdf-tb-page">
            <input
              class="pdf-tb-input"
              type="number" min="1" :max="numPages"
              :value="currentPage"
              @change="onJumpInput"
            />
            <span class="text-muted-foreground">/ {{ numPages || '–' }}</span>
          </span>
          <button class="pdf-tb-btn" title="下一页" @click="nextPage"><ChevronDown class="h-4 w-4" /></button>
        </div>
        <div class="pdf-tb-group">
          <button class="pdf-tb-btn" title="缩小" @click="zoomOut"><ZoomOut class="h-4 w-4" /></button>
          <span class="pdf-tb-zoom">{{ zoomPct }}%</span>
          <button class="pdf-tb-btn" title="放大" @click="zoomIn"><ZoomIn class="h-4 w-4" /></button>
        </div>
        <button
          class="pdf-tb-btn"
          :title="fitMode === 'width' ? '当前：适配宽度（点击切换为适配高度）' : '当前：适配高度（点击切换为适配宽度）'"
          @click="toggleFitMode"
        >
          <MoveHorizontal v-if="fitMode === 'width'" class="h-4 w-4" />
          <MoveVertical v-else class="h-4 w-4" />
        </button>
        <button v-if="paperId" class="pdf-tb-btn" title="复制本页链接" @click="copyPageLink">
          <Link2 class="h-4 w-4" />
        </button>
        <button
          v-if="paperId"
          class="pdf-tb-btn"
          :class="{ 'pdf-tb-btn-active': captureMode }"
          :title="captureMode ? '框选截图模式（Esc 取消）' : '框选截图（截取一块区域并上传图床）'"
          @click="toggleCaptureMode"
        >
          <Crop class="h-4 w-4" />
        </button>
      </div>

      <!-- Scroll area -->
      <div
        ref="viewerRef"
        class="pdf-scroll"
        :class="{ 'pdf-capturing': captureMode }"
        @scroll="onScroll"
        @mousedown="onCaptureDown"
      >
        <div
          v-for="p in pages" :key="p.num"
          class="pdf-page" :data-pdf-page="p.num"
          :style="{ width: p.wPt * effectiveScale + 'px', height: p.hPt * effectiveScale + 'px' }"
        />
        <!-- Rubber-band selection rectangle (capture mode) -->
        <div
          v-if="dragRect"
          class="pdf-capture-rect"
          :style="{ left: dragRect.x + 'px', top: dragRect.y + 'px', width: dragRect.w + 'px', height: dragRect.h + 'px' }"
        />
      </div>

      <!-- Floating selection link button -->
      <button
        v-if="showSelBtn"
        class="pdf-sel-btn"
        :style="{ left: selBtnPos.x + 'px', top: selBtnPos.y + 'px' }"
        @mousedown.prevent
        @click="copySelectionLink"
      >
        <Link2 class="h-3.5 w-3.5" /> 复制选区链接
      </button>

      <!-- Loading overlay -->
      <div v-if="loading" class="pdf-loading">
        <Loader2 class="h-5 w-5 animate-spin text-primary" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.pdf-viewer-root { position: relative; height: 100%; background: var(--muted); display: flex; flex-direction: column; }
.pdf-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--muted-foreground); }

/* Toolbar */
.pdf-toolbar {
  display: flex; align-items: center; gap: 12px; justify-content: center;
  height: 36px; padding: 0 8px; border-bottom: 1px solid var(--border);
  background: var(--background); flex-shrink: 0; user-select: none;
}
.pdf-tb-group { display: flex; align-items: center; gap: 2px; }
.pdf-tb-btn {
  display: inline-flex; align-items: center; justify-content: center;
  height: 26px; width: 26px; border-radius: var(--radius-sm);
  color: var(--foreground); background: none; border: none; cursor: pointer;
}
.pdf-tb-btn:hover { background: var(--accent); color: var(--accent-foreground); }
.pdf-tb-btn-active, .pdf-tb-btn-active:hover { background: var(--primary); color: var(--primary-foreground); }
.pdf-tb-page { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; }
.pdf-tb-input {
  width: 40px; text-align: center; font-size: 12px; padding: 2px 4px;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--background); color: var(--foreground);
  -moz-appearance: textfield;
}
.pdf-tb-input::-webkit-outer-spin-button, .pdf-tb-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.pdf-tb-zoom { font-size: 12px; min-width: 38px; text-align: center; color: var(--muted-foreground); }

/* Scroll area + pages */
.pdf-scroll { flex: 1; overflow: auto; padding: 12px 0; position: relative; }

/* Capture (框选截图) mode: crosshair cursor + suppress native text selection so a drag
   draws a region instead of selecting text. The text layer ignores pointer events so the
   mousedown lands on the scroll container and our rubber-band handler runs. */
.pdf-scroll.pdf-capturing { cursor: crosshair; user-select: none; }
.pdf-scroll.pdf-capturing :deep(.textLayer) { pointer-events: none; }
.pdf-capture-rect {
  position: absolute; z-index: 40; pointer-events: none;
  border: 1.5px dashed var(--primary);
  background: color-mix(in oklch, var(--primary) 14%, transparent);
}
.pdf-page {
  position: relative; margin: 0 auto 12px auto; background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18); scroll-margin-top: 12px;
}
/* Dark mode: gray page so the gutter/loading state matches the dark-rendered canvas
   (must match DARK_PAGE_COLORS.background in the script). */
:global(.dark) .pdf-page { background: #3a3a3a; }
.pdf-page :deep(.pdf-canvas) { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; }
.pdf-page :deep(.textLayer) { z-index: 2; }
.pdf-page :deep(.textLayer ::selection) { background: rgba(37, 99, 235, 0.28); }

/* Transient region highlight (non-persisted, mirrors the Markdown anchor flash). */
.pdf-page :deep(.pdf-region-flash) {
  position: absolute; z-index: 3; pointer-events: none;
  background: color-mix(in oklch, var(--primary) 32%, transparent);
  border-radius: 2px; animation: pdf-region-fade 2.2s ease-out forwards;
}
@keyframes pdf-region-fade {
  0% { background: color-mix(in oklch, var(--primary) 42%, transparent); }
  100% { background: color-mix(in oklch, var(--primary) 0%, transparent); }
}

/* Floating "copy selection link" */
.pdf-sel-btn {
  position: absolute; z-index: 50; transform: translateX(-50%);
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; padding: 5px 9px; cursor: pointer;
  background: var(--popover); color: var(--popover-foreground);
  border: 1px solid var(--border); border-radius: calc(var(--radius) + 2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); white-space: nowrap;
}
.pdf-sel-btn:hover { background: var(--accent); color: var(--accent-foreground); }

.pdf-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
</style>
