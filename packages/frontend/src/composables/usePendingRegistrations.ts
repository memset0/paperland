import { ref } from 'vue'
import { usersApi } from '@/api/client'

/**
 * Number of self-registered accounts awaiting approval, shared by the sidebar badge (App) and the
 * Settings users table (which refreshes it after approve / reject). Admin-only data.
 */
const pendingCount = ref(0)

export function usePendingRegistrations() {
  async function refreshPending() {
    try {
      pendingCount.value = (await usersApi.list()).data.filter((u) => u.status === 'pending').length
    } catch {
      pendingCount.value = 0
    }
  }
  function setPendingCount(n: number) {
    pendingCount.value = n
  }
  return { pendingCount, refreshPending, setPendingCount }
}
