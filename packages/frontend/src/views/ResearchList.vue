<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Loader2, Telescope, ArrowLeft } from '@lucide/vue'
import type { ResearchStepStatus } from '@paperland/shared'
import AppPage from '@/components/AppPage.vue'
import ScopeToggle from '@/components/ScopeToggle.vue'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useResearchStore } from '@/stores/research'

const store = useResearchStore()
const router = useRouter()
const STATUS_LABEL: Record<ResearchStepStatus, string> = { queued: 'Queued', awaiting_output: 'Thinking', streaming: 'Writing', done: 'Done', failed: 'Failed', cancelled: 'Cancelled' }
onMounted(() => store.fetchSessions())
watch(() => store.scope, () => store.fetchSessions())
function formatTime(iso: string): string { return new Date(iso).toLocaleString() }
</script>

<template>
  <AppPage>
    <template #actions>
      <ScopeToggle v-model="store.scope" />
      <Button variant="outline" @click="router.push('/research')"><ArrowLeft />Topics</Button>
    </template>

    <div v-if="store.listLoading && !store.sessions.length" class="flex items-center justify-center py-16">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
    </div>

    <div v-else-if="store.sessions.length === 0" class="rounded-md border bg-card p-12 text-center text-muted-foreground">
      <Telescope class="mx-auto h-10 w-10 stroke-1" />
      <p class="mt-3 text-sm">No previous research sessions</p>
      <p class="mt-1 text-xs">Open Topics to begin new research.</p>
    </div>

    <div v-else class="space-y-2">
      <Card
        v-for="s in store.sessions" :key="s.id"
        as="button"
        class="w-full gap-1.5 p-4 text-left transition hover:shadow-md"
        @click="router.push(`/research/${s.id}`)"
      >
        <div class="flex items-start justify-between gap-3">
          <h3 class="font-semibold leading-snug">{{ s.title }}</h3>
          <Badge v-if="s.latest_status" :variant="s.latest_status === 'failed' ? 'destructive' : 'secondary'" class="shrink-0">
            {{ STATUS_LABEL[s.latest_status] }}
          </Badge>
        </div>
        <p class="line-clamp-2 text-xs text-muted-foreground">{{ s.topic }}</p>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>{{ s.step_count }} step{{ s.step_count === 1 ? '' : 's' }}</span>
          <span>{{ s.version_count }} version{{ s.version_count === 1 ? '' : 's' }}</span>
          <span v-if="store.scope === 'all'">by {{ s.owner_name }}</span>
          <span class="ml-auto tabular-nums">{{ formatTime(s.updated_at) }}</span>
        </div>
      </Card>
    </div>


  </AppPage>
</template>
