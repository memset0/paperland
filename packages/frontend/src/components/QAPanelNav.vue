<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { useScrollSpy } from '@/composables/useScrollSpy'

const props = defineProps<{
  entries: Array<{ key: string; title: string }>
  scrollContainer: HTMLElement | null
  paperId: number
}>()

const containerRef = ref<HTMLElement | null>(null)
const expanded = ref(false)
const isTouchDevice = ref(false)

// Track scroll container's position for fixed positioning
const containerRect = ref<{ top: number; bottom: number; right: number } | null>(null)

watch(() => props.scrollContainer, (el) => { containerRef.value = el }, { immediate: true })

const { activeIndex, visibleIndices, refresh, setActive } = useScrollSpy(containerRef, '[data-qa-entry]')

watch(() => props.entries.length, () => {
  nextTick(() => refresh())
})

// Update container rect on scroll and resize
function updateRect() {
  if (!props.scrollContainer) { containerRect.value = null; return }
  const r = props.scrollContainer.getBoundingClientRect()
  containerRect.value = { top: r.top, bottom: r.bottom, right: r.right }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  isTouchDevice.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  updateRect()
  window.addEventListener('resize', updateRect)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateRect)
  if (resizeObserver) resizeObserver.disconnect()
})

watch(() => props.scrollContainer, (el, oldEl) => {
  if (resizeObserver) resizeObserver.disconnect()
  if (oldEl) oldEl.removeEventListener('scroll', updateRect)
  if (el) {
    el.addEventListener('scroll', updateRect, { passive: true })
    resizeObserver = new ResizeObserver(updateRect)
    resizeObserver.observe(el)
    updateRect()
  }
}, { immediate: true })

const navStyle = computed(() => {
  if (!containerRect.value) return { display: 'none' }
  const { right } = containerRect.value
  return {
    position: 'fixed' as const,
    top: '0px',
    height: '100vh',
    right: (window.innerWidth - right + 6) + 'px',
  }
})

// Hover on the track — always allow, touch devices won't fire mouseenter anyway
function onTrackEnter() {
  expanded.value = true
}
function onTrackLeave() {
  expanded.value = false
}

function onTapToggle(e: Event) {
  if (isTouchDevice.value) {
    e.stopPropagation()
    expanded.value = !expanded.value
  }
}

function onDocumentTap(e: Event) {
  if (!isTouchDevice.value || !expanded.value) return
  const nav = document.querySelector('[data-qa-panel-nav]')
  if (nav && !nav.contains(e.target as Node)) {
    expanded.value = false
  }
}

onMounted(() => { document.addEventListener('click', onDocumentTap) })
onUnmounted(() => { document.removeEventListener('click', onDocumentTap) })

function navigateTo(entry: { key: string }, index: number) {
  if (!props.scrollContainer) return
  const trigger = props.scrollContainer.querySelector<HTMLButtonElement>(
    `[data-qa-entry="${entry.key}"]`
  )
  if (!trigger) return

  setActive(index)

  // Open via click if currently closed; the Collapsible's @update:open
  // handler in QAList persists the new state to localStorage.
  if (trigger.getAttribute('data-state') === 'closed') {
    trigger.click()
  }

  trigger.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div
    v-if="entries.length"
    data-qa-panel-nav
    class="qa-panel-nav"
    :style="navStyle"
  >
    <div
      class="nav-track"
      :class="{ 'is-expanded': expanded }"
      @mouseenter="onTrackEnter"
      @mouseleave="onTrackLeave"
    >
      <button
        v-for="(entry, i) in entries"
        :key="entry.key"
        class="nav-item"
        :class="{
          active: i === activeIndex,
          visible: visibleIndices.has(i),
        }"
        @click.stop="navigateTo(entry, i)"
        @touchstart.passive="onTapToggle"
      >
        <span class="dot"></span>
        <span class="label">{{ entry.title }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.qa-panel-nav {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  z-index: 20;
  pointer-events: none;
  overflow: visible;
}

.nav-track {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 4px;
  border-radius: 6px;
  transition: width 0.2s ease, opacity 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  width: 16px;
  opacity: 0.5;
  pointer-events: auto;
  position: relative;
}

/* Invisible hit area extending left for easier hover trigger */
.nav-track::before {
  content: '';
  position: absolute;
  top: -8px;
  bottom: -8px;
  right: -8px;
  left: -20px;
}


.nav-track.is-expanded {
  width: 260px;
  opacity: 1;
  background: color-mix(in oklch, var(--popover) 96%, transparent);
  backdrop-filter: blur(8px);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.1), 0 0 1px rgba(0, 0, 0, 0.08);
  padding: 6px 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: none;
  cursor: pointer;
  padding: 2px 3px;
  border-radius: 3px;
  transition: background 0.15s ease;
  min-height: 14px;
  text-align: left;
  position: relative;
  z-index: 1;
}

.is-expanded .nav-item {
  padding: 3px 6px;
  min-height: 22px;
}

.is-expanded .nav-item:hover {
  background: var(--accent);
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: color-mix(in oklch, var(--foreground) 25%, transparent);
  flex-shrink: 0;
  transition: background 0.2s ease, transform 0.15s ease;
}

.nav-item.visible .dot {
  background: color-mix(in oklch, var(--foreground) 60%, transparent);
}

.nav-item.active .dot {
  background: var(--primary);
  transform: scale(1.3);
}

.label {
  display: none;
  font-size: 11px;
  line-height: 1.3;
  color: var(--foreground);
  opacity: 0.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1;
  transition: opacity 0.2s ease, color 0.2s ease;
}

.is-expanded .label {
  display: block;
}

.nav-item.visible .label {
  opacity: 0.85;
}

.nav-item.active .label {
  color: var(--primary);
  opacity: 1;
  font-weight: 500;
}
</style>
