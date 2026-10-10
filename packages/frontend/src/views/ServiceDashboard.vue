<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from '@/api/client'
import { Activity, Clock, AlertCircle, CheckCircle2, Loader2, ChevronLeft, ChevronRight, RefreshCw } from '@lucide/vue'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import AppPage from '@/components/AppPage.vue'

interface ServiceInfo { name: string; type: string; running: number; pending: number; max_concurrency: number }
interface Execution { id: number; service_name: string; paper_id: number; status: string; progress: number; created_at: string; finished_at: string | null; error: string | null }

const services = ref<ServiceInfo[]>([])
const executions = ref<Execution[]>([])
const pagination = ref({ page: 1, page_size: 20, total: 0, total_pages: 0 })
const loading = ref(false)
const filterService = ref('all')
const filterStatus = ref('all')
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
    if (filterService.value && filterService.value !== 'all') p.set('service_name', filterService.value)
    if (filterStatus.value && filterStatus.value !== 'all') p.set('status', filterStatus.value)
    const r = await api.get<{ data: Execution[]; pagination: typeof pagination.value }>(`/api/services/executions?${p}`)
    executions.value = r.data; pagination.value = r.pagination
  } finally { loading.value = false }
}

const statusIcon: Record<string, any> = {
  done: CheckCircle2,
  failed: AlertCircle,
  running: Loader2,
  pending: Clock,
  waiting: Clock,
  blocked: AlertCircle,
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'
const statusVariant: Record<string, BadgeVariant> = {
  done: 'secondary',
  failed: 'destructive',
  running: 'default',
  pending: 'outline',
  waiting: 'outline',
  blocked: 'outline',
}

const backfilling = ref(false)
const backfillMsg = ref<string | null>(null)
async function backfillS2() {
  backfilling.value = true
  backfillMsg.value = null
  try {
    const r = await api.post<{ success: boolean; queued: number }>('/api/services/backfill/semantic_scholar_service')
    backfillMsg.value = `Queued S2 backfill for ${r.queued} ${r.queued === 1 ? 'paper' : 'papers'}`
    await fetchAll()
  } catch (err: any) {
    backfillMsg.value = err.message || 'Backfill failed'
  } finally {
    backfilling.value = false
  }
}

async function retryExecution(e: Execution) {
  retryingId.value = e.id
  retryError.value = null
  try {
    await api.post(`/api/papers/${e.paper_id}/services/${e.service_name}/trigger`)
    await fetchAll()
  } catch (err: any) {
    retryError.value = err.message || 'Retry failed'
  } finally {
    retryingId.value = null
  }
}
</script>

<template>
  <AppPage>
    <template #actions>
      <div class="flex flex-col items-end gap-1">
        <Button variant="outline" size="sm" :disabled="backfilling" @click="backfillS2">
          <Loader2 v-if="backfilling" class="animate-spin" /><RefreshCw v-else />
          Backfill S2 data
        </Button>
        <span v-if="backfillMsg" class="text-xs text-muted-foreground">{{ backfillMsg }}</span>
      </div>
    </template>
    <div class="space-y-6">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <Card v-for="svc in services" :key="svc.name" class="p-4">
        <div class="flex items-center gap-2">
          <Activity class="h-4 w-4 text-primary" />
          <span class="text-sm font-semibold">{{ svc.name }}</span>
        </div>
        <div class="space-y-1.5 text-xs">
          <div class="flex justify-between"><span class="text-muted-foreground">Type</span><span class="font-medium">{{ svc.type }}</span></div>
          <div class="flex justify-between"><span class="text-muted-foreground">Concurrency</span><span class="font-mono">{{ svc.running }}/{{ svc.max_concurrency }}</span></div>
          <div class="flex justify-between"><span class="text-muted-foreground">Queued</span><span class="font-mono">{{ svc.pending }}</span></div>
        </div>
      </Card>
    </div>

    <Alert v-if="retryError" variant="destructive">
      <AlertCircle />
      <AlertDescription class="flex items-center justify-between gap-2">
        <span>{{ retryError }}</span>
        <Button variant="ghost" size="icon-xs" @click="retryError = null">×</Button>
      </AlertDescription>
    </Alert>

    <Card class="overflow-hidden gap-0 py-0">
      <div class="border-b px-5 py-3 flex items-center gap-4">
        <h3 class="text-sm font-semibold shrink-0">Run history</h3>
        <Select v-model="filterService" @update:model-value="fetchExecs()">
          <SelectTrigger class="w-32"><SelectValue placeholder="All services" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All services</SelectItem>
            <SelectItem v-for="s in services" :key="s.name" :value="s.name">{{ s.name }}</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="filterStatus" @update:model-value="fetchExecs()">
          <SelectTrigger class="w-32"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem v-for="s in ['pending','running','done','failed','blocked']" :key="s" :value="s">{{ s }}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Service</TableHead>
            <TableHead class="w-16">Paper</TableHead>
            <TableHead class="w-24">Status</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Error</TableHead>
            <TableHead class="w-16">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="e in executions" :key="e.id">
            <TableCell class="font-medium">{{ e.service_name }}</TableCell>
            <TableCell class="text-muted-foreground font-mono">#{{ e.paper_id }}</TableCell>
            <TableCell>
              <Badge :variant="statusVariant[e.status] || 'outline'" class="gap-1">
                <component :is="statusIcon[e.status] || Clock" :class="e.status === 'running' ? 'animate-spin' : ''" />
                {{ e.status }}
              </Badge>
            </TableCell>
            <TableCell class="text-muted-foreground">{{ new Date(e.created_at).toLocaleString() }}</TableCell>
            <TableCell class="text-destructive max-w-[200px] truncate" :title="e.error || undefined">{{ e.error || '-' }}</TableCell>
            <TableCell>
              <Button
                v-if="e.status === 'failed' || e.status === 'blocked'"
                variant="ghost" size="icon-sm"
                :disabled="retryingId === e.id"
                title="Retry"
                @click="retryExecution(e)"
              >
                <Loader2 v-if="retryingId === e.id" class="animate-spin" />
                <RefreshCw v-else />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div v-if="pagination.total_pages > 1" class="flex items-center justify-center gap-2 border-t py-3">
        <Button variant="outline" size="icon-sm" :disabled="pagination.page <= 1" @click="pagination.page--; fetchExecs()">
          <ChevronLeft />
        </Button>
        <span class="text-xs text-muted-foreground tabular-nums">{{ pagination.page }}/{{ pagination.total_pages }}</span>
        <Button variant="outline" size="icon-sm" :disabled="pagination.page >= pagination.total_pages" @click="pagination.page++; fetchExecs()">
          <ChevronRight />
        </Button>
      </div>
    </Card>
    </div>
  </AppPage>
</template>
