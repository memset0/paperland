// Extension settings: { base_url, token }. Values saved on the options page (storage.sync)
// win; otherwise fall back to src/preset.json, which the personalized download from
// Paperland's Extension page bundles (absent when loaded straight from the repo).
export const ext = globalThis.browser ?? globalThis.chrome

/** Merge saved settings over the preset, field by field; anything missing becomes ''. */
export function mergeSettings(stored, preset) {
  const pick = (key) => (typeof stored?.[key] === 'string' && stored[key]) || (typeof preset?.[key] === 'string' && preset[key]) || ''
  return { base_url: pick('base_url'), token: pick('token') }
}

async function loadPreset() {
  try {
    const res = await fetch(ext.runtime.getURL('src/preset.json'))
    return res.ok ? await res.json() : null
  } catch {
    return null // no preset bundled, or malformed JSON
  }
}

export async function loadSettings() {
  const stored = await ext.storage.sync.get(['base_url', 'token'])
  return mergeSettings(stored, await loadPreset())
}

export async function saveSettings({ base_url, token }) {
  await ext.storage.sync.set({ base_url: base_url.trim().replace(/\/+$/, ''), token: token.trim() })
}
