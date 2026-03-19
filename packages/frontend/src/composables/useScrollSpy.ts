import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue'

/**
 * Tracks which elements from a set are currently visible in a scroll container.
 * Uses IntersectionObserver for performance.
 *
 * Returns:
 * - visibleIndices: Set of indices currently intersecting the viewport
 * - activeIndex: the topmost visible element index (for primary highlight)
 */
export function useScrollSpy(
  containerRef: Ref<HTMLElement | null>,
  selector: string,
) {
  const activeIndex = ref(-1)
  const visibleIndices = ref<Set<number>>(new Set())
  let observer: IntersectionObserver | null = null
  const ratios = new Map<Element, number>()

  function computeActive() {
    if (!containerRef.value) return
    const elements = Array.from(containerRef.value.querySelectorAll(selector))
    if (!elements.length) {
      activeIndex.value = -1
      visibleIndices.value = new Set()
      return
    }

    const containerRect = containerRef.value.getBoundingClientRect()
    const newVisible = new Set<number>()
    let bestIdx = -1
    let bestTop = Infinity

    for (let i = 0; i < elements.length; i++) {
      const ratio = ratios.get(elements[i]) ?? 0
      if (ratio > 0) {
        newVisible.add(i)
        const rect = elements[i].getBoundingClientRect()
        const topRelative = rect.top - containerRect.top
        if (topRelative < bestTop) {
          bestTop = topRelative
          bestIdx = i
        }
      }
    }

    // If nothing visible, find nearest element above the container top
    if (bestIdx === -1) {
      let nearestDist = Infinity
      for (let i = 0; i < elements.length; i++) {
        const rect = elements[i].getBoundingClientRect()
        const topRelative = rect.top - containerRect.top
        if (topRelative < 0 && Math.abs(topRelative) < nearestDist) {
          nearestDist = Math.abs(topRelative)
          bestIdx = i
        }
      }
      if (bestIdx !== -1) newVisible.add(bestIdx)
    }

    activeIndex.value = bestIdx
    visibleIndices.value = newVisible
  }

  function setup() {
    cleanup()
    const container = containerRef.value
    if (!container) return

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target, entry.intersectionRatio)
        }
        computeActive()
      },
      {
        root: container,
        threshold: [0, 0.05, 0.1, 0.25, 0.5],
      },
    )

    const targets = container.querySelectorAll(selector)
    targets.forEach((el) => observer!.observe(el))
  }

  function cleanup() {
    if (observer) {
      observer.disconnect()
      observer = null
    }
    ratios.clear()
  }

  function refresh() {
    setup()
  }

  onMounted(() => {
    watch(containerRef, () => setup(), { immediate: true })
  })

  onUnmounted(() => {
    cleanup()
  })

  /** Immediately override the active index (e.g. on click). Observer will take over on next scroll. */
  function setActive(index: number) {
    activeIndex.value = index
  }

  return { activeIndex, visibleIndices, refresh, setActive }
}
