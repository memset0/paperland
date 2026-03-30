<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from '@/api/client'
import { Activity, Clock, AlertCircle, CheckCircle2, Loader2, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-vue-next'

interface ServiceInfo { name: string; type: string; running: number; pending: number; max_concurrency: number }
interface Execution { id: number; service_name: string; paper_id: number; status: string; progress: number; created_at: string; finished_at: string | null; error: string | null }

const services = ref<ServiceInfo[]>([])
const executions = ref<Execution[]>([])
const pagination = ref({ page: 1, page_size: 20, total: 0, total_pages: 0 })
const loading = ref(false)
const filterService = ref('')
const filterStatus = ref('')
const retryingId = ref<number | null>(null)
const retryError = ref<string | null>(null)

let poll: ReturnType<typeof setInterval> | null = null
onMounted(async () => { await fetchAll(); poll = setInterval(fetchAll, 5000) })
onUnmounted(() => { if (poll) clearInterval(poll) })

async function fetchAll() { await fetchServices(); await fetchExecs() }
async function fetchServices() { services.value = (await api.get<{ data: ServiceInfo[] }>('/api/services')).data }
async function fetchExecs() {
  loading.value = true
  try {
    const p = new URLSearchParams({ page: String(pagination.value.page), page_size: '20' })
    if (filterService.value) p.set('service_name', filterService.value)
    if (filterStatus.value) p.set('status', filterStatus.value)
    const r = await api.get<{ data: Execution[]; pagination: typeof pagination.value }>(`/api/services/executions?${p}`)
    executions.value = r.data; pagination.value = r.pagination
  } finally { loading.value = false }
}

const statusStyle: Record<string, { bg: string; text: string; icon: any }> = {
  done: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
  failed: { bg: 'bg-red-50', text: 'text-red-700', icon: AlertCircle },
  running: { bg: 'bg-blue-50', text: 'text-blue-700', icon: Loader2 },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', icon: Clock },
  waiting: { bg: 'bg-amber-50', text: 'text-amber-700', icon: Clock },
  blocked: { bg: 'bg-gray-100', text: 'text-gray-500', icon: AlertCircle },
}
function getStyle(s: string) { return statusStyle[s] || statusStyle.pending }

async function retryExecution(e: Execution) {
  retryingId.value = e.id
  retryError.value = null
  try {
    await api.post(`/api/papers/${e.paper_id}/services/${e.service_name}/trigger`)
    await fetchAll()
  } catch (err: any) {
    retryError.value = err.message || '重试失败'
  } finally {
    retryingId.value = null
  }
}
</script>

<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-gray-900">服务管理</h1>
      <p class="text-sm text-gray-500 mt-0.5">监控数据抓取和处理服务</p>
    </div>

    <!-- Service cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <div v-for="svc in services" :key="svc.name" class="rounded-xl border border-gray-200 bg-white p-4">
        <div class="flex items-center gap-2 mb-3">
          <Activity class="h-4 w-4 text-indigo-500" />
          <span class="text-sm font-semibold text-gray-900">{{ svc.name }}</span>
        </div>
        <div class="space-y-1.5 text-xs">
          <div class="flex justify-between"><span class="text-gray-500">类型</span><span class="font-medium text-gray-700">{{ svc.type }}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">并发</span><span class="font-mono text-gray-700">{{ svc.running }}/{{ svc.max_concurrency }}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">排队</span><span class="font-mono text-gray-700">{{ svc.pending }}</span></div>
        </div>
      </div>
    </div>

    <!-- Retry error notification -->
    <div v-if="retryError" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between">
      <span class="text-sm text-red-700">{{ retryError }}</span>
      <button @click="retryError = null" class="text-red-400 hover:text-red-600 text-xs">&times;</button>
    </div>

    <!-- Execution history -->
    <div class="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div class="border-b border-gray-100 px-5 py-3 flex items-center gap-4">
        <h3 class="text-sm font-semibold text-gray-900 shrink-0">执行历史</h3>
        <select v-model="filterService" @change="fetchExecs()" class="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 focus:outline-none">
          <option value="">全部服务</option>
          <option v-for="s in services" :key="s.name" :value="s.name">{{ s.name }}</option>
        </select>
        <select v-model="filterStatus" @change="fetchExecs()" class="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 focus:outline-none">
          <option value="">全部状态</option>
          <option v-for="s in ['pending','running','done','failed','blocked']" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>

      <table class="w-full text-xs">
        <thead><tr class="border-b border-gray-100 bg-gray-50/60">
          <th class="px-4 py-2.5 text-left font-medium text-gray-500 uppercase tracking-wider">服务</th>
          <th class="px-4 py-2.5 text-left font-medium text-gray-500 uppercase tracking-wider w-16">论文</th>
          <th class="px-4 py-2.5 text-left font-medium text-gray-500 uppercase tracking-wider w-24">状态</th>
          <th class="px-4 py-2.5 text-left font-medium text-gray-500 uppercase tracking-wider">时间</th>
          <th class="px-4 py-2.5 text-left font-medium text-gray-500 uppercase tracking-wider">错误</th>
          <th class="px-4 py-2.5 text-left font-medium text-gray-500 uppercase tracking-wider w-16">操作</th>
        </tr></thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="e in executions" :key="e.id" class="hover:bg-gray-50/40">
            <td class="px-4 py-2.5 font-medium text-gray-700">{{ e.service_name }}</td>
            <td class="px-4 py-2.5 text-gray-500 font-mono">#{{ e.paper_id }}</td>
            <td class="px-4 py-2.5">
              <span :class="['inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', getStyle(e.status).bg, getStyle(e.status).text]">
                <component :is="getStyle(e.status).icon" class="h-3 w-3" :class="e.status === 'running' ? 'animate-spin' : ''" />
                {{ e.status }}
              </span>
            </td>
            <td class="px-4 py-2.5 text-gray-400">{{ new Date(e.created_at).toLocaleString() }}</td>
            <td class="px-4 py-2.5 text-red-500 max-w-[200px] truncate" :title="e.error || undefined">{{ e.error || '-' }}</td>
            <td class="px-4 py-2.5">
              <button
                v-if="e.status === 'failed' || e.status === 'blocked'"
                :disabled="retryingId === e.id"
                @click="retryExecution(e)"
                class="rounded-md p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="重试"
              >
                <Loader2 v-if="retryingId === e.id" class="h-3.5 w-3.5 animate-spin" />
                <RefreshCw v-else class="h-3.5 w-3.5" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="pagination.total_pages > 1" class="flex items-center justify-center gap-2 border-t border-gray-100 py-3">
        <button :disabled="pagination.page <= 1" @click="pagination.page--; fetchExecs()" class="rounded-md border border-gray-200 p-1 disabled:opacity-30"><ChevronLeft class="h-3.5 w-3.5" /></button>
        <span class="text-xs text-gray-500 tabular-nums">{{ pagination.page }}/{{ pagination.total_pages }}</span>
        <button :disabled="pagination.page >= pagination.total_pages" @click="pagination.page++; fetchExecs()" class="rounded-md border border-gray-200 p-1 disabled:opacity-30"><ChevronRight class="h-3.5 w-3.5" /></button>
      </div>
    </div>
  </div>
</template>
