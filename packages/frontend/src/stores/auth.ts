import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/client'
import type { SessionUser } from '@paperland/shared'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<SessionUser | null>(null)
  const loaded = ref(false)

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  /** Load the current user on startup (and after auth state changes). */
  async function fetchMe() {
    try {
      const res = await authApi.me()
      user.value = res.user
    } catch {
      user.value = null
    } finally {
      loaded.value = true
    }
  }

  async function login(username: string, password: string): Promise<SessionUser> {
    const res = await authApi.login(username, password)
    user.value = res.user
    return res.user
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout()
    } finally {
      user.value = null
    }
  }

  async function updateAccount(payload: { username?: string; current_password?: string; password?: string }): Promise<SessionUser> {
    const res = await authApi.updateAccount(payload)
    user.value = res.user
    return res.user
  }

  return { user, loaded, isAuthenticated, isAdmin, fetchMe, login, logout, updateAccount }
})
