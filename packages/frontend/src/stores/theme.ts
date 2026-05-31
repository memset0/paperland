import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export type theme_mode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'paperland_theme'
const MODES: theme_mode[] = ['light', 'dark', 'system']

/** Read the persisted mode, defaulting to 'system' on missing/invalid/unavailable storage. */
function readStoredMode(): theme_mode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* localStorage unavailable (private mode, etc.) */
  }
  return 'system'
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

/**
 * Theme switcher: cycles light → dark → system, persists the choice, and applies the
 * resolved theme to <html> via the `.dark` class (whose tokens are already defined in
 * assets/main.css). In 'system' mode it follows prefers-color-scheme live.
 *
 * The pre-paint bootstrap in index.html applies the same `.dark` class before the bundle
 * loads (no flash); this store is authoritative once mounted and reads the same key/logic.
 */
export const useThemeStore = defineStore('theme', () => {
  const mode = ref<theme_mode>(readStoredMode())
  // Live OS preference; only feeds `resolved` while in 'system' mode.
  const systemDark = ref(systemPrefersDark())

  const resolved = computed<'light' | 'dark'>(() =>
    mode.value === 'system' ? (systemDark.value ? 'dark' : 'light') : mode.value,
  )

  function applyResolved(r: 'light' | 'dark') {
    const root = document.documentElement
    if (r === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }

  // Apply immediately (boot script may have set it; this keeps the store authoritative)
  // and on every subsequent change of the resolved theme.
  applyResolved(resolved.value)
  watch(resolved, applyResolved)

  function setMode(m: theme_mode) {
    mode.value = m
    try {
      localStorage.setItem(STORAGE_KEY, m)
    } catch {
      /* noop */
    }
  }

  /** Advance Light → Dark → System → Light. */
  function cycle() {
    const i = MODES.indexOf(mode.value)
    setMode(MODES[(i + 1) % MODES.length])
  }

  // Follow OS color-scheme changes live (matters only while mode === 'system').
  try {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    mql.addEventListener('change', (e) => {
      systemDark.value = e.matches
    })
  } catch {
    /* matchMedia unavailable */
  }

  return { mode, resolved, setMode, cycle }
})
