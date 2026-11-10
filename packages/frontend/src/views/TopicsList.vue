<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { History, Loader2, Plus, Search, Telescope, ArrowUpRight } from '@lucide/vue'
import type { ResearchSeed, TopicDefaultAccess, TopicSummary } from '@paperland/shared'
import { topicsApi } from '@/api/topics'
import AppPage from '@/components/AppPage.vue'
import ScopeToggle from '@/components/ScopeToggle.vue'
import TopicAccessSelect from '@/components/TopicAccessSelect.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuthStore } from '@/stores/auth'

const route = useRoute(), router = useRouter(), auth = useAuthStore()
const topics = ref<TopicSummary[]>([]), loading = ref(false), error = ref(''), search = ref(''), scope = ref<'mine' | 'all'>('all')
const showCreate = ref(false), title = ref(''), description = ref(''), creating = ref(false), seed = ref<ResearchSeed | null>(null)
const defaultAccess = ref<TopicDefaultAccess>('none')
let generation = 0, alive = true
const filtered = computed(() => topics.value.filter((t) => `${t.title} ${t.description}`.toLowerCase().includes(search.value.toLowerCase())))
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
      <Button variant="ghost" size="icon" title="Research history" @click="router.push('/research/history')"><History /></Button>
      <Button @click="newTopic"><Plus />New topic</Button>
    </template>
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <ScopeToggle v-model="scope" />
      <div class="relative min-w-0 flex-1"><Search class="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input v-model="search" placeholder="Search topics…" class="pl-9" /></div>
    </div>
    <div v-if="loading && !topics.length" class="flex justify-center py-20"><Loader2 class="size-5 animate-spin text-primary" /><span class="sr-only">Loading topics…</span></div>
    <div v-else-if="error" class="rounded-lg border p-8 text-center"><p>{{ error }}</p><Button variant="outline" class="mt-4" @click="load">Try again</Button></div>
    <div v-else-if="!topics.length" class="rounded-xl border border-dashed px-6 py-16 text-center">
      <Telescope class="mx-auto mb-4 size-9 text-primary" /><h2 class="font-medium">A home for your research</h2>
      <p class="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Keep a report and organized papers together. Connect your agent to build on them over time.</p>
      <Button class="mt-6" @click="newTopic"><Plus />Create your first topic</Button>
      <div class="mt-5"><RouterLink to="/research/history" class="text-xs text-muted-foreground hover:text-foreground">Open previous research</RouterLink></div>
    </div>
    <p v-else-if="!filtered.length" class="py-16 text-center text-sm text-muted-foreground">No topics match your search.</p>
    <div v-else class="grid gap-4 sm:grid-cols-2">
      <RouterLink v-for="topic in filtered" :key="topic.id" :to="`/topics/${topic.id}`" class="group min-w-0 rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/30">
        <div class="mb-4 flex items-center justify-between"><Telescope class="size-4 text-primary" /><Badge variant="secondary" class="capitalize">{{ topic.permission }}</Badge></div>
        <h2 class="flex items-start justify-between gap-3 font-semibold leading-snug"><span class="break-words">{{ topic.title }}</span><ArrowUpRight class="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-primary" /></h2>
        <p v-if="topic.description" class="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{{ topic.description }}</p>
        <div class="mt-5 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{{ topic.owner_display_name }}</span><time :datetime="topic.updated_at">{{ new Date(topic.updated_at).toLocaleDateString() }}</time></div>
      </RouterLink>
    </div>
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
