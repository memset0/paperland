import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'

interface TokenInfo {
  id: number
  token: string
  created_at: string
  revoked_at: string | null
}

export const useSettingsStore = defineStore('settings', () => {
  const tokens = ref<TokenInfo[]>([])

  async function fetchTokens() {
    const res = await api.get<{ data: TokenInfo[] }>('/api/settings/tokens')
    tokens.value = res.data
  }

  async function issueToken() {
    const res = await api.post<{ id: number; token: string; created_at: string }>('/api/settings/tokens')
    await fetchTokens()
    return res.token
  }

  async function revokeToken(id: number) {
    await api.delete(`/api/settings/tokens/${id}`)
    await fetchTokens()
  }

  return { tokens, fetchTokens, issueToken, revokeToken }
})
