import { ref } from 'vue'

// Shared, app-wide login dialog visibility (opened by the sidebar, route guards,
// and any 401 response via the auth event bus).
const loginOpen = ref(false)

export function useLoginPrompt() {
  return {
    loginOpen,
    openLogin: () => { loginOpen.value = true },
    closeLogin: () => { loginOpen.value = false },
  }
}
