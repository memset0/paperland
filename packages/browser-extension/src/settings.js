// Extension settings persisted in storage.sync: { base_url, token }.
export const ext = globalThis.browser ?? globalThis.chrome

export async function loadSettings() {
  const { base_url = '', token = '' } = await ext.storage.sync.get(['base_url', 'token'])
  return { base_url, token }
}

export async function saveSettings({ base_url, token }) {
  await ext.storage.sync.set({ base_url: base_url.trim().replace(/\/+$/, ''), token: token.trim() })
}
