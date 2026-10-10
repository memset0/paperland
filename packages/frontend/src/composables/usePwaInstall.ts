import { computed, ref } from 'vue'

/** Chromium's install-prompt event (not in lib.dom). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Module-level singleton: `beforeinstallprompt` can fire long before the Settings page mounts,
// so main.ts imports this module at startup to start listening right away.
const deferred = ref<BeforeInstallPromptEvent | null>(null)
const justInstalled = ref(false)

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as { standalone?: boolean }).standalone === true
}
const standalone = ref(isStandalone())

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred.value = e as BeforeInstallPromptEvent
})
window.addEventListener('appinstalled', () => {
  deferred.value = null
  justInstalled.value = true
})
window.matchMedia('(display-mode: standalone)').addEventListener('change', () => {
  standalone.value = isStandalone()
})

/** Register the (pass-through) service worker in production builds only, keeping Vite HMR untouched. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const register = () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* installability only; ignore */ })
  }
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}

export function usePwaInstall() {
  const canInstall = computed(() => !!deferred.value && !standalone.value)
  const installed = computed(() => standalone.value || justInstalled.value)

  async function install() {
    const e = deferred.value
    if (!e) return
    await e.prompt()
    const { outcome } = await e.userChoice
    // A prompt event can only be used once.
    deferred.value = null
    if (outcome === 'accepted') justInstalled.value = true
  }

  return { canInstall, installed, standalone, install }
}
