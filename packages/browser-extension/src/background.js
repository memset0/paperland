import { extractArxivIdFromUrl, normalizeArxivId, buildOpenUrl } from './arxiv.js'
import { ext, loadSettings } from './settings.js'

// Fallback for pages whose URL carries no id: read the Highwire/Google Scholar
// `citation_arxiv_id` meta tag. Runs in the page via the activeTab grant; fails
// (→ null) on restricted pages such as the browser's own UI.
async function arxivIdFromPage(tabId) {
  try {
    const [res] = await ext.scripting.executeScript({
      target: { tabId },
      func: () => document.querySelector('meta[name="citation_arxiv_id"]')?.content ?? null,
    })
    return normalizeArxivId(res?.result)
  } catch {
    return null
  }
}

async function flashBadge(tabId, text) {
  await ext.action.setBadgeText({ tabId, text })
  setTimeout(() => ext.action.setBadgeText({ tabId, text: '' }).catch(() => {}), 2000)
}

// Toolbar click — also fired by the `_execute_action` keyboard shortcut (Alt+Shift+P).
ext.action.onClicked.addListener(async (tab) => {
  const { base_url, token } = await loadSettings()
  if (!base_url || !token) {
    await ext.runtime.openOptionsPage()
    return
  }

  const arxivId = extractArxivIdFromUrl(tab.url ?? '') ?? (await arxivIdFromPage(tab.id))
  if (!arxivId) {
    await flashBadge(tab.id, '?')
    return
  }

  await ext.tabs.create({
    url: buildOpenUrl(base_url, arxivId, token),
    index: tab.index + 1,
    openerTabId: tab.id,
  })
})
