import { ref } from 'vue'

const params = new URLSearchParams(window.location.search)

const isEmbed = ref(params.get('embed') === '1')

const rawBg = params.get('bg')
const bgColor = ref<string | null>(
  rawBg && /^[0-9a-fA-F]{6}$/.test(rawBg) ? `#${rawBg}` : null
)

export function useEmbedMode() {
  return { isEmbed, bgColor }
}
