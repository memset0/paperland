<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from '@/api/client'

interface ServiceInfo {
  name: string
  type: string
  running: number
  pending: number
  max_concurrency: number
}

interface Execution {
  id: number
  service_name: string
  paper_id: number
  status: string
  progress: number
  created_at: string
  finished_at: string | null
  result: string | null
  error: string | null
}

const services = ref<ServiceInfo[]>([])
const executions = ref<Execution[]>([])
const pagination = ref({ page: 1, page_size: 20, total: 0, total_pages: 0 })
const loading = ref(false)
const filterService = ref('')
const filterStatus = ref('')

const executionHeaders = [
  { title: 'ID', key: 'id', width: '60px' },
  { title: '服务', key: 'service_name' },
  { title: '论文 ID', key: 'paper_id', width: '80px' },
  { title: '状态', key: 'status', width: '100px' },
  { title: '进度', key: 'progress', width: '80px' },
  { title: '创建时间', key: 'created_at' },
  { title: '完成时间', key: 'finished_at' },
  { title: '错误', key: 'error' },
]

let pollTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await fetchServices()
  await fetchExecutions()
  pollTimer = setInterval(async () => {
    await fetchServices()
    await fetchExecutions()
  }, 5000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})

async function fetchServices() {
  const res = await api.get<{ data: ServiceInfo[] }>('/api/services')
  services.value = res.data
}

async function fetchExecutions() {
  loading.value = true
  try {
    const params = new URLSearchParams({ page: String(pagination.value.page), page_size: String(pagination.value.page_size) })
    if (filterService.value) params.set('service_name', filterService.value)
    if (filterStatus.value) params.set('status', filterStatus.value)
    const res = await api.get<{ data: Execution[]; pagination: typeof pagination.value }>(`/api/services/executions?${params}`)
    executions.value = res.data
    pagination.value = res.pagination
  } finally {
    loading.value = false
  }
}

function statusColor(status: string): string {
  const map: Record<string, string> = { done: 'success', failed: 'error', running: 'info', pending: 'warning', waiting: 'warning', blocked: 'grey' }
  return map[status] || 'grey'
}

function onUpdateOptions(opts: any) {
  pagination.value.page = opts.page
  pagination.value.page_size = opts.itemsPerPage
  fetchExecutions()
}
</script>

<template>
  <div>
    <h1 class="text-h4 mb-4">服务管理</h1>

    <!-- Service overview -->
    <v-row class="mb-4">
      <v-col v-for="svc in services" :key="svc.name" cols="12" sm="6" md="3">
        <v-card>
          <v-card-title class="text-subtitle-1">
            <v-icon class="mr-1" size="small">mdi-cog</v-icon>
            {{ svc.name }}
          </v-card-title>
          <v-card-text>
            <div class="d-flex justify-space-between text-body-2">
              <span>类型</span>
              <v-chip size="x-small" variant="tonal">{{ svc.type }}</v-chip>
            </div>
            <div class="d-flex justify-space-between text-body-2 mt-1">
              <span>并发</span>
              <span>{{ svc.running }} / {{ svc.max_concurrency }}</span>
            </div>
            <div class="d-flex justify-space-between text-body-2 mt-1">
              <span>排队</span>
              <span>{{ svc.pending }}</span>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col v-if="services.length === 0" cols="12">
        <v-card><v-card-text class="text-center text-grey">暂无注册的服务</v-card-text></v-card>
      </v-col>
    </v-row>

    <!-- Execution history -->
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-history</v-icon>
        执行历史
      </v-card-title>
      <v-card-text class="pb-0">
        <v-row>
          <v-col cols="12" sm="4">
            <v-select v-model="filterService" :items="['', ...services.map(s => s.name)]" label="筛选服务" variant="outlined" density="compact" clearable hide-details @update:model-value="fetchExecutions" />
          </v-col>
          <v-col cols="12" sm="4">
            <v-select v-model="filterStatus" :items="['', 'pending', 'waiting', 'running', 'done', 'failed', 'blocked']" label="筛选状态" variant="outlined" density="compact" clearable hide-details @update:model-value="fetchExecutions" />
          </v-col>
        </v-row>
      </v-card-text>
      <v-data-table-server
        :headers="executionHeaders"
        :items="executions"
        :items-length="pagination.total"
        :loading="loading"
        :items-per-page="pagination.page_size"
        :page="pagination.page"
        @update:options="onUpdateOptions"
      >
        <template #item.status="{ item }">
          <v-chip :color="statusColor(item.status)" size="small" variant="tonal">{{ item.status }}</v-chip>
        </template>
        <template #item.progress="{ item }">
          <v-progress-linear v-if="item.status === 'running'" :model-value="item.progress" color="info" height="6" rounded />
          <span v-else>{{ item.progress }}%</span>
        </template>
        <template #item.created_at="{ item }">{{ new Date(item.created_at).toLocaleString() }}</template>
        <template #item.finished_at="{ item }">{{ item.finished_at ? new Date(item.finished_at).toLocaleString() : '-' }}</template>
        <template #item.error="{ item }">
          <span v-if="item.error" class="text-error text-truncate d-inline-block" style="max-width: 200px;">{{ item.error }}</span>
          <span v-else>-</span>
        </template>
      </v-data-table-server>
    </v-card>
  </div>
</template>
