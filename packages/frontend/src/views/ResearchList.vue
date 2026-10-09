<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loader2, Plus, Telescope } from '@lucide/vue'
import { toast } from 'vue-sonner'
import type { ResearchSeed, ResearchStepStatus } from '@paperland/shared'
import AppPage from '@/components/AppPage.vue'
import ScopeToggle from '@/components/ScopeToggle.vue'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { researchApi } from '@/api/client'
import { useResearchStore } from '@/stores/research'

const store = useResearchStore()
const route = useRoute()
const router = useRouter()

const showCreate = ref(false)
const creating = ref(false)
const topic = ref('')
const model = ref<string | null>(null)
const seed = ref<ResearchSeed | null>(null)
const seedResultId = ref<number | null>(null)

const STATUS_LABEL: Record<ResearchStepStatus, string> = {
  queued: 'Queued',
  awaiting_output: 'Thinking',
  streaming: 'Writing',
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

onMounted(async () => {
  await Promise.all([store.fetchSessions(), store.fetchModels().catch(() => {})])
  await openFromQuery()
})

watch(() => store.scope, () => store.fetchSessions())

/** `/research?new=1[&seed_result=<id>]` opens the create dialog (the QA "Deep Research" entry). */
async function openFromQuery() {
  if (route.query.new !== '1') return
  const resultId = Number(route.query.seed_result)
  seed.value = null
  seedResultId.value = null
  if (Number.isInteger(resultId) && resultId > 0) {
    try {
      seed.value = (await researchApi.seedPreview(resultId)).data
      seedResultId.value = resultId
    } catch {
      toast.error('The QA answer is no longer available')
    }
  }
  topic.value = seed.value ? seed.value.question : ''
  openCreate()
  router.replace({ query: {} })
}

function openCreate() {
  model.value = store.defaultModel
  showCreate.value = true
}

function startFresh() {
  seed.value = null
  seedResultId.value = null
  topic.value = ''
  openCreate()
}

async function submitCreate() {
  if (!topic.value.trim() || !model.value) return
  creating.value = true
  try {
    const detail = await store.create({
      topic: topic.value.trim(),
      model_name: model.value,
      ...(seedResultId.value ? { seed_result_id: seedResultId.value } : {}),
    })
    showCreate.value = false
    router.push(`/research/${detail.id}`)
  } finally {
    creating.value = false
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString()
}
</script>

<template>
  <AppPage>
    <template #actions>
      <ScopeToggle v-model="store.scope" />
      <Button @click="startFresh"><Plus />New research</Button>
    </template>

    <div v-if="store.listLoading && !store.sessions.length" class="flex items-center justify-center py-16">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
    </div>

    <div v-else-if="store.sessions.length === 0" class="rounded-md border bg-card p-12 text-center text-muted-foreground">
      <Telescope class="mx-auto h-10 w-10 stroke-1" />
      <p class="mt-3 text-sm">No research sessions yet</p>
      <p class="mt-1 text-xs">Start one with "New research", or from any Q&A answer.</p>
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

    <Dialog v-model:open="showCreate">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>New research</DialogTitle>
          <DialogDescription>
            The agent searches the web and returns a report plus a sectioned paper list, which you can refine round by round.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div v-if="seed" class="rounded-md border bg-muted/40 p-3 text-xs">
            <div class="font-medium">Starting from a Q&A answer</div>
            <div class="mt-1 text-muted-foreground">{{ seed.paper_title }}</div>
            <div class="mt-1 line-clamp-2">Q: {{ seed.question }}</div>
            <p class="mt-1 text-muted-foreground">The answer is copied into this session; later changes to the Q&A do not affect it.</p>
          </div>
          <div class="space-y-1.5">
            <Label>Topic <span class="text-destructive">*</span></Label>
            <Textarea v-model="topic" rows="4" placeholder="What should the agent research?" autofocus />
          </div>
          <div class="space-y-1.5">
            <Label>Model</Label>
            <Select v-model="model">
              <SelectTrigger class="w-full"><SelectValue placeholder="Select a Codex model" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="m in store.codexModels" :key="m" :value="m">{{ m }}</SelectItem>
              </SelectContent>
            </Select>
            <p v-if="!store.codexModels.length" class="text-xs text-destructive">No Codex model is configured; Deep Research requires one.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="showCreate = false">Cancel</Button>
          <Button :disabled="!topic.trim() || !model || creating" @click="submitCreate">
            <Loader2 v-if="creating" class="animate-spin" />Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </AppPage>
</template>
