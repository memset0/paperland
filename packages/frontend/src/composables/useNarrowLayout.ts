import { useMediaQuery } from '@vueuse/core'

/**
 * Whether complex pages (paper detail, Deep Research detail) use their single-column layout.
 * They switch at 900px; below it they show the mobile bottom bar.
 */
export const NARROW_LAYOUT_QUERY = '(max-width: 899.98px)'

export function useNarrowLayout() {
  return useMediaQuery(NARROW_LAYOUT_QUERY)
}
