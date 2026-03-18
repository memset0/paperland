<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { Key, Plus, Trash2, Copy, Check } from 'lucide-vue-next'

const store = useSettingsStore()
const newToken = ref<string | null>(null)
const issuing = ref(false)
const copied = ref(false)

onMounted(() => store.fetchTokens())

async function issueNew() { issuing.value = true; try { newToken.value = await store.issueToken() } finally { issuing.value = false } }
function copyToken() { if (newToken.value) { navigator.clipboard.writeText(newToken.value); copied.value = true; setTimeout(() => copied.value = false, 2000) } }
</script>

<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-gray-900">设置</h1>
      <p class="text-sm text-gray-500 mt-0.5">管理 API Token 和全局配置</p>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white">
      <div class="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <div class="flex items-center gap-2">
          <Key class="h-4 w-4 text-gray-500" />
          <h3 class="text-sm font-semibold text-gray-900">API Token</h3>
        </div>
        <button @click="issueNew" :disabled="issuing"
          class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition">
          <Plus class="h-3 w-3" /> 签发
        </button>
      </div>

      <!-- New token banner -->
      <div v-if="newToken" class="mx-5 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <p class="text-xs font-medium text-emerald-800 mb-1.5">新 Token 已生成（仅显示一次）</p>
        <div class="flex items-center gap-2">
          <code class="flex-1 rounded-md bg-white px-3 py-1.5 text-xs font-mono text-gray-700 border border-emerald-200 break-all select-all">{{ newToken }}</code>
          <button @click="copyToken" class="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-100 transition shrink-0">
            <Check v-if="copied" class="h-4 w-4" /><Copy v-else class="h-4 w-4" />
          </button>
        </div>
      </div>

      <table class="w-full text-sm">
        <thead><tr class="border-b border-gray-100 bg-gray-50/60">
          <th class="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token</th>
          <th class="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">创建时间</th>
          <th class="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">状态</th>
          <th class="px-5 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">操作</th>
        </tr></thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="t in store.tokens" :key="t.id">
            <td class="px-5 py-3"><code class="text-xs font-mono text-gray-600 bg-gray-50 rounded px-1.5 py-0.5">{{ t.token }}</code></td>
            <td class="px-5 py-3 text-xs text-gray-500">{{ new Date(t.created_at).toLocaleString() }}</td>
            <td class="px-5 py-3">
              <span :class="['inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', t.revoked_at ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700']">
                {{ t.revoked_at ? '已撤销' : '有效' }}
              </span>
            </td>
            <td class="px-5 py-3 text-right">
              <button v-if="!t.revoked_at" @click="store.revokeToken(t.id)" class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition">
                <Trash2 class="h-3 w-3" /> 撤销
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!store.tokens.length" class="text-center py-10 text-sm text-gray-400">暂无 Token</div>
    </div>
  </div>
</template>
