import { toValue, type MaybeRefOrGetter } from 'vue'
import { useTitle } from '@vueuse/core'

const BRAND = 'Paperland'

/**
 * Build the browser tab title: `{name} · Paperland`, or just `Paperland`
 * when no page-specific name is provided. Single source of truth for the
 * title format, shared by the router guard and per-view dynamic titles.
 */
export function formatTitle(name?: string | null): string {
  const t = name?.trim()
  return t ? `${t} · ${BRAND}` : BRAND
}

/**
 * Reactively bind `document.title` to a content source (e.g. the loaded
 * paper's title or an Idea Forge project name). The watcher is created in
 * the calling component's scope, so it stops automatically on unmount; the
 * next route's `afterEach` guard then resets the title.
 */
export function usePageTitle(source: MaybeRefOrGetter<string | null | undefined>) {
  return useTitle(() => formatTitle(toValue(source)))
}
