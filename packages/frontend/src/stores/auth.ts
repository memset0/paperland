import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/client'
import type { SessionUser } from '@paperland/shared'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<SessionUser | null>(null)
  const loaded = ref(false)
  // Whether the anonymous login screen offers Register (auth.registration_enabled).
  const registrationEnabled = ref(true)

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  /** Load the current user on startup (and after auth state changes). */
  async function fetchMe() {
    try {
      const res = await authApi.me()
      user.value = res.user
      registrationEnabled.value = res.registration_enabled ?? true
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

  /** Self-register; the account is pending until an admin approves it (no login happens). */
  async function register(payload: { username: string; password: string; nickname?: string | null }): Promise<void> {
    await authApi.register(payload)
  }

  /** Drop the local user (e.g. on a 401) — App then shows the login screen. */
  function clearUser() {
    user.value = null
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout()
    } finally {
      user.value = null
    }
  }

  async function updateAccount(payload: { username?: string; nickname?: string | null; current_password?: string; password?: string }): Promise<SessionUser> {
    const res = await authApi.updateAccount(payload)
    user.value = res.user
    return res.user
  }

  return { user, loaded, registrationEnabled, isAuthenticated, isAdmin, fetchMe, login, register, clearUser, logout, updateAccount }
})
