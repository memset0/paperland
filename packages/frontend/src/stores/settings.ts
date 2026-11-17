import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'
import type { ApiToken } from '@paperland/shared'

type TokenInfo = ApiToken

export const useSettingsStore = defineStore('settings', () => {
  const tokens = ref<TokenInfo[]>([])

  async function fetchTokens() {
    const res = await api.get<{ data: TokenInfo[] }>('/api/settings/tokens')
    tokens.value = res.data
  }

  async function revokeToken(id: number) {
    await api.delete(`/api/settings/tokens/${id}`)
    await fetchTokens()
  }

  return { tokens, fetchTokens, revokeToken }
})
