<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConferencesStore } from '@/stores/conferences'
import { useAuthStore } from '@/stores/auth'
import { useLoginPrompt } from '@/composables/useLoginPrompt'
import { CalendarDays, Plus, Search, ChevronLeft, ChevronRight, Loader2 } from '@lucide/vue'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const router = useRouter()
const store = useConferencesStore()
const auth = useAuthStore()
const { openLogin } = useLoginPrompt()

const search = ref('')
const yearInput = ref('')

const showCreate = ref(false)
const creating = ref(false)
const createForm = ref<{ name: string; year: string; start_date: string; end_date: string; location: string; description: string; link: string }>({
  name: '', year: '', start_date: '', end_date: '', location: '', description: '', link: '',
})

onMounted(() => fetch())

async function fetch(page = 1) {
  const year = yearInput.value ? parseInt(yearInput.value, 10) : null
  await store.fetchConferences({
    search: search.value || undefined,
    year: year && !isNaN(year) ? year : null,
    page,
  })
}

watch([search, yearInput], () => fetch(1))

function openCreate() {
  if (!auth.isAuthenticated) {
    openLogin()
    return
  }
  createForm.value = { name: '', year: '', start_date: '', end_date: '', location: '', description: '', link: '' }
  showCreate.value = true
}

async function submitCreate() {
  if (!createForm.value.name.trim()) return
  creating.value = true
  try {
    const yearNum = createForm.value.year ? parseInt(createForm.value.year, 10) : null
    const conf = await store.createConference({
      name: createForm.value.name.trim(),
      year: yearNum && !isNaN(yearNum) ? yearNum : null,
      start_date: createForm.value.start_date || null,
      end_date: createForm.value.end_date || null,
      location: createForm.value.location || null,
      description: createForm.value.description || null,
      link: createForm.value.link || null,
    })
    showCreate.value = false
    router.push(`/conferences/${conf.id}`)
  } finally {
    creating.value = false
  }
}

function gotoConference(id: number) {
  router.push(`/conferences/${id}`)
}

function goToPage(p: number) { fetch(p) }
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="flex items-center gap-2 text-xl font-semibold">
          <CalendarDays class="h-5 w-5 text-primary" />会议
        </h1>
        <p class="text-sm text-muted-foreground mt-0.5">按会议组织候选论文，确认后一键入库</p>
      </div>
      <Button @click="openCreate"><Plus />新建会议</Button>
    </div>

    <div class="flex gap-2">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <Input v-model="search" placeholder="搜索会议名称..." class="pl-9" />
      </div>
      <Input v-model="yearInput" placeholder="年份" type="number" class="w-28" />
    </div>

    <div v-if="store.loading" class="flex items-center justify-center py-16">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
    </div>

    <div v-else-if="store.list.length === 0" class="rounded-md border bg-card p-12 text-center text-muted-foreground">
      <CalendarDays class="mx-auto h-10 w-10 stroke-1" />
      <p class="mt-3 text-sm">{{ search || yearInput ? '没有匹配的会议' : '暂无会议' }}</p>
      <p v-if="!search && !yearInput" class="mt-1 text-xs">点右上角「新建会议」开始</p>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card
        v-for="conf in store.list" :key="conf.id"
        as="button"
        class="text-left p-5 hover:shadow-md transition group"
        @click="gotoConference(conf.id)"
      >
        <div class="flex items-start justify-between gap-2">
          <h3 class="font-semibold leading-snug">{{ conf.name }}</h3>
          <Badge v-if="conf.year" variant="outline">{{ conf.year }}</Badge>
        </div>
        <p v-if="conf.description" class="text-xs text-muted-foreground line-clamp-2">{{ conf.description }}</p>
        <div class="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{{ conf.paper_count }} 篇</Badge>
          <Badge v-if="conf.status_counts.pending > 0" variant="outline">待确认 {{ conf.status_counts.pending }}</Badge>
          <Badge v-if="conf.status_counts.candidate > 0" variant="outline">候选 {{ conf.status_counts.candidate }}</Badge>
          <Badge v-if="conf.status_counts.ingested > 0" variant="outline">已入库 {{ conf.status_counts.ingested }}</Badge>
        </div>
      </Card>
    </div>

    <div v-if="store.pagination.total_pages > 1" class="flex items-center justify-center gap-2">
      <Button variant="outline" size="icon-sm" :disabled="store.pagination.page <= 1" @click="goToPage(store.pagination.page - 1)">
        <ChevronLeft />
      </Button>
      <span class="text-xs text-muted-foreground tabular-nums">{{ store.pagination.page }} / {{ store.pagination.total_pages }}</span>
      <Button variant="outline" size="icon-sm" :disabled="store.pagination.page >= store.pagination.total_pages" @click="goToPage(store.pagination.page + 1)">
        <ChevronRight />
      </Button>
    </div>

    <Dialog v-model:open="showCreate">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>新建会议</DialogTitle>
        </DialogHeader>
        <div class="space-y-3">
          <div class="space-y-1.5">
            <Label>名称 <span class="text-destructive">*</span></Label>
            <Input v-model="createForm.name" placeholder="如 NeurIPS 2024" autofocus />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1.5">
              <Label>年份</Label>
              <Input v-model="createForm.year" type="number" placeholder="2024" />
            </div>
            <div class="space-y-1.5">
              <Label>地点</Label>
              <Input v-model="createForm.location" placeholder="Vancouver" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1.5">
              <Label>开始日期</Label>
              <Input v-model="createForm.start_date" type="date" />
            </div>
            <div class="space-y-1.5">
              <Label>结束日期</Label>
              <Input v-model="createForm.end_date" type="date" />
            </div>
          </div>
          <div class="space-y-1.5">
            <Label>链接</Label>
            <Input v-model="createForm.link" placeholder="https://..." />
          </div>
          <div class="space-y-1.5">
            <Label>描述</Label>
            <Textarea v-model="createForm.description" rows="2" placeholder="可选" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="showCreate = false">取消</Button>
          <Button :disabled="!createForm.name.trim() || creating" @click="submitCreate">
            {{ creating ? '创建中...' : '创建' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
