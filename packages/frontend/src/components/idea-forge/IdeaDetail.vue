<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useIdeasStore } from '@/stores/ideas'
import ScoreInput from './ScoreInput.vue'
import MarkdownContent from '@/components/MarkdownContent.vue'
import { Save, RotateCcw, AlertTriangle } from '@lucide/vue'
import type { IdeaCategory } from '@paperland/shared'
import { IDEA_CATEGORIES, IDEA_CATEGORY_LABELS } from '@/lib/idea-categories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

const props = defineProps<{
  projectName: string
  category: string
  ideaName: string
}>()

const emit = defineEmits<{
  moved: [newCategory: IdeaCategory]
  saved: []
}>()

const store = useIdeasStore()

const editing = ref(false)
const editBody = ref('')
const editSummary = ref('')
const editComment = ref('')
const editScore = ref(0)
const saving = ref(false)
const saveTimer = ref<ReturnType<typeof setTimeout> | null>(null)

const detail = computed(() => store.currentDetail)
const hasConflict = computed(() => store.conflict)

watch(() => `${props.projectName}/${props.category}/${props.ideaName}`, async () => {
  if (!props.ideaName) return
  await store.fetchDetail(props.projectName, props.category, props.ideaName)
  syncFromDetail()
}, { immediate: true })

function syncFromDetail() {
  if (!detail.value) return
  editBody.value = detail.value.body
  editSummary.value = detail.value.frontmatter.summary || ''
  editComment.value = detail.value.frontmatter.my_comment || ''
  editScore.value = detail.value.frontmatter.my_score || 0
  editing.value = false
}

function scheduleSave() {
  if (saveTimer.value) clearTimeout(saveTimer.value)
  saveTimer.value = setTimeout(() => doSave(), 2000)
}

async function doSave() {
  if (!detail.value || saving.value) return
  saving.value = true
  try {
    const fm = {
      ...detail.value.frontmatter,
      summary: editSummary.value,
      my_comment: editComment.value,
      my_score: editScore.value,
    }
    const res = await store.updateIdea(
      props.projectName, props.category, props.ideaName,
      detail.value.content_hash, fm, editBody.value
    )
    if (res) emit('saved')
  } finally {
    saving.value = false
  }
}

async function immediateSave() {
  if (saveTimer.value) clearTimeout(saveTimer.value)
  await doSave()
}

function onScoreChange(val: number) {
  editScore.value = val
  immediateSave()
}

async function moveToCategory(cat: IdeaCategory) {
  if (!detail.value || cat === props.category) return
  const result = await store.moveIdea(
    props.projectName, props.category, props.ideaName, cat, detail.value.content_hash
  )
  if (result) emit('moved', cat)
}

async function reload() {
  await store.fetchDetail(props.projectName, props.category, props.ideaName)
  syncFromDetail()
}

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    immediateSave()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (saveTimer.value) clearTimeout(saveTimer.value)
})
</script>

<template>
  <div v-if="!detail" class="flex items-center justify-center h-full text-muted-foreground text-sm">
    Select an idea to view details
  </div>
  <div v-else class="flex flex-col h-full">
    <div class="shrink-0 border-b bg-background p-4 space-y-3">
      <Alert v-if="hasConflict" variant="destructive">
        <AlertTriangle />
        <AlertDescription class="flex items-center justify-between gap-2 w-full">
          <span>File has been modified externally.</span>
          <Button size="xs" variant="destructive" @click="reload">
            <RotateCcw />Reload
          </Button>
        </AlertDescription>
      </Alert>

      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground">My Score</span>
            <ScoreInput :model-value="editScore" @update:model-value="onScoreChange" />
          </div>
          <div v-if="detail.frontmatter.llm_score" class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground">LLM</span>
            <ScoreInput :model-value="detail.frontmatter.llm_score" readonly size="sm" />
          </div>
          <div v-if="detail.frontmatter.author" class="text-xs text-muted-foreground">
            by {{ detail.frontmatter.author }}
          </div>
        </div>
        <Button v-if="!hasConflict" size="sm" :disabled="saving" @click="immediateSave">
          <Save />{{ saving ? 'Saving...' : 'Save' }}
        </Button>
      </div>

      <div class="flex gap-1.5 flex-wrap">
        <Button
          v-for="cat in IDEA_CATEGORIES" :key="cat"
          size="xs"
          :variant="cat === detail.category ? 'secondary' : 'outline'"
          @click="moveToCategory(cat)"
        >
          {{ IDEA_CATEGORY_LABELS[cat] }}
        </Button>
      </div>

      <Textarea
        v-model="editComment"
        placeholder="Your review comment..."
        rows="3"
        class="max-h-[50vh]"
        @input="scheduleSave"
      />
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <div class="space-y-1.5">
        <Label>Summary</Label>
        <Input v-model="editSummary" placeholder="One-line summary..." @input="scheduleSave" />
      </div>

      <div v-if="detail.frontmatter.tags?.length" class="flex flex-wrap gap-1.5">
        <Badge v-for="tag in detail.frontmatter.tags" :key="tag" variant="secondary">{{ tag }}</Badge>
      </div>

      <div class="flex gap-4 text-xs text-muted-foreground">
        <span>Created: {{ detail.frontmatter.create_time?.slice(0, 19) }}</span>
        <span>Updated: {{ detail.frontmatter.update_time?.slice(0, 19) }}</span>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label>Content</Label>
          <Button variant="link" size="xs" @click="editing = !editing">
            {{ editing ? 'Preview' : 'Edit' }}
          </Button>
        </div>
        <Textarea
          v-if="editing"
          v-model="editBody"
          class="min-h-[300px] font-mono resize-y"
          @input="scheduleSave"
        />
        <div v-else class="rounded-md border bg-muted/40 p-4">
          <MarkdownContent :content="editBody" />
        </div>
      </div>
    </div>
  </div>
</template>
