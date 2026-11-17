<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Archive, History, Loader2, Plus, Search, Telescope } from '@lucide/vue'
import type { ResearchSeed, TopicDefaultAccess, TopicSummary } from '@paperland/shared'
import { topicsApi } from '@/api/topics'
import AppPage from '@/components/AppPage.vue'
import ScopeToggle from '@/components/ScopeToggle.vue'
import TopicAccessSelect from '@/components/topics/TopicAccessSelect.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import TopicCard from '@/components/topics/TopicCard.vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuthStore } from '@/stores/auth'

const route = useRoute(), router = useRouter(), auth = useAuthStore()
const topics = ref<TopicSummary[]>([]), loading = ref(false), error = ref(''), search = ref(''), scope = ref<'mine' | 'all'>('all')
const showCreate = ref(false), title = ref(''), description = ref(''), creating = ref(false), seed = ref<ResearchSeed | null>(null)
const defaultAccess = ref<TopicDefaultAccess>('none')
let generation = 0, alive = true
const filtered = computed(() => topics.value.filter((t) => `${t.title} ${t.description}`.toLowerCase().includes(search.value.toLowerCase())))
// Archived Topics are kept apart from active ones on their own tab.
const active = computed(() => filtered.value.filter((t) => !t.archived_at))
const archived = computed(() => filtered.value.filter((t) => t.archived_at))
const tab = ref<'active' | 'archived'>('active')
async function load() {
  const n = ++generation, user = auth.user?.id
  loading.value = true; error.value = ''
  try { const result = await topicsApi.list(scope.value); if (n === generation && user === auth.user?.id) topics.value = result.data }
  catch (e) { if (n === generation) error.value = (e as Error).message }
  finally { if (n === generation) loading.value = false }
}
async function fromQuery() {
  if (route.query.new !== '1') return
  const resultId = Number(route.query.seed_result), user = auth.user?.id
  seed.value = null; title.value = ''; description.value = ''; defaultAccess.value = 'none'
  if (Number.isSafeInteger(resultId) && resultId > 0) {
    try { const result = await topicsApi.seed(resultId); if (!alive || user !== auth.user?.id) return; seed.value = result.data; title.value = result.data.question.slice(0, 200) }
    catch { return }
  }
  showCreate.value = true
  await router.replace({ query: {} })
}
function newTopic() { seed.value = null; title.value = ''; description.value = ''; defaultAccess.value = 'none'; showCreate.value = true }
async function create() {
  if (!title.value.trim() || creating.value) return
  const user = auth.user?.id
  creating.value = true
  try {
    const result = await topicsApi.create({ title: title.value.trim(), description: description.value.trim(), default_access: defaultAccess.value, ...(seed.value ? { seed_result_id: seed.value.qa_result_id } : {}) })
    if (!alive || user !== auth.user?.id) return
    showCreate.value = false; await router.push(`/topics/${result.data.id}`)
  } catch {} finally { creating.value = false }
}
watch(scope, load)
watch(() => auth.user?.id, () => { generation++; topics.value = []; seed.value = null; showCreate.value = false; void load() })
watch(() => route.query.new, () => { void fromQuery() })
onMounted(() => { void load(); void fromQuery() })
onBeforeUnmount(() => { alive = false; generation++ })
</script>

<template>
  <AppPage>
    <template #actions>
      <Button variant="ghost" size="icon" title="Research history" aria-label="Research history" @click="router.push('/research/history')"><History /></Button>
      <Button @click="newTopic"><Plus />New topic</Button>
    </template>
    <Tabs v-model="tab" class="gap-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <TabsList>
          <TabsTrigger value="active" class="px-3">Active<span class="tabular-nums text-muted-foreground">{{ active.length }}</span></TabsTrigger>
          <TabsTrigger value="archived" class="px-3">Archived<span class="tabular-nums text-muted-foreground">{{ archived.length }}</span></TabsTrigger>
        </TabsList>
        <div class="flex min-w-0 items-center gap-2 sm:ml-auto sm:w-80">
          <ScopeToggle v-model="scope" />
          <div class="relative min-w-0 flex-1">
            <Search class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="search" placeholder="Search topics…" aria-label="Search topics" class="pl-8" />
          </div>
        </div>
      </div>

      <div v-if="loading && !topics.length" class="grid gap-4 sm:grid-cols-2">
        <div v-for="n in 4" :key="n" class="space-y-3 rounded-lg p-5 ring-1 ring-foreground/10"><Skeleton class="h-5 w-2/3" /><Skeleton class="h-4 w-full" /><Skeleton class="h-4 w-4/5" /><Skeleton class="mt-6 h-3 w-1/3" /></div>
        <span class="sr-only">Loading topics…</span>
      </div>
      <div v-else-if="error" class="rounded-lg border border-dashed p-10 text-center">
        <p class="text-sm">{{ error }}</p>
        <Button variant="outline" size="sm" class="mt-4" @click="load">Try again</Button>
      </div>
      <div v-else-if="!topics.length" class="flex flex-col items-center rounded-lg border border-dashed px-6 py-16 text-center">
        <div class="mb-4 flex size-11 items-center justify-center rounded-full bg-muted"><Telescope class="size-5 text-muted-foreground" /></div>
        <h2 class="text-base font-semibold">A home for your research</h2>
        <p class="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Keep a report and organized papers together. Connect your agent to build on them over time.</p>
        <Button class="mt-6" @click="newTopic"><Plus />Create your first topic</Button>
        <RouterLink to="/research/history" class="mt-4 text-xs text-muted-foreground hover:text-foreground">Open previous research</RouterLink>
      </div>
      <template v-else>
        <TabsContent value="active">
          <div v-if="active.length" class="grid gap-4 sm:grid-cols-2"><TopicCard v-for="topic in active" :key="topic.id" :topic="topic" /></div>
          <p v-else class="rounded-lg border border-dashed py-14 text-center text-sm text-muted-foreground">{{ search.trim() ? 'No active topics match your search.' : 'All your topics are archived.' }}</p>
        </TabsContent>
        <TabsContent value="archived">
          <div v-if="archived.length" class="grid gap-4 sm:grid-cols-2"><TopicCard v-for="topic in archived" :key="topic.id" :topic="topic" /></div>
          <div v-else class="flex flex-col items-center rounded-lg border border-dashed py-14 text-center">
            <Archive class="mb-3 size-5 text-muted-foreground" />
            <p class="text-sm text-muted-foreground">{{ search.trim() ? 'No archived topics match your search.' : 'Archived topics will appear here.' }}</p>
          </div>
        </TabsContent>
      </template>
    </Tabs>
    <Dialog v-model:open="showCreate">
      <DialogContent>
        <DialogHeader><DialogTitle>New topic</DialogTitle><DialogDescription>Create a shared home for a research report and an organized paper list.</DialogDescription></DialogHeader>
        <form id="create-topic" class="space-y-4" @submit.prevent="create">
          <div class="space-y-2"><Label for="topic-title">Title</Label><Input id="topic-title" v-model="title" maxlength="500" placeholder="What are you researching?" required autofocus /></div>
          <div class="space-y-2"><Label for="topic-description">Description (optional)</Label><Textarea id="topic-description" v-model="description" maxlength="10000" placeholder="A short introduction to this topic" /></div>
          <TopicAccessSelect v-model="defaultAccess" :disabled="creating" />
          <div v-if="seed" class="rounded-md bg-muted p-3 text-sm"><p class="font-medium">Starting from a Q&A answer</p><p class="mt-1 text-muted-foreground">{{ seed.paper_title }}</p><p class="mt-1 line-clamp-2 text-muted-foreground">{{ seed.question }}</p></div>
        </form>
        <DialogFooter><Button variant="outline" @click="showCreate = false">Cancel</Button><Button type="submit" form="create-topic" :disabled="!title.trim() || creating"><Loader2 v-if="creating" class="animate-spin" />{{ creating ? 'Creating…' : 'Create topic' }}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </AppPage>
</template>
