<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useIdeasStore } from '@/stores/ideas'
import ScoreInput from './ScoreInput.vue'
import MarkdownContent from '@/components/MarkdownContent.vue'
import { Save, RotateCcw, AlertTriangle } from 'lucide-vue-next'
import type { IdeaCategory } from '@paperland/shared'

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
const categories: IdeaCategory[] = ['unreviewed', 'under-review', 'validating', 'archived']
const categoryLabels: Record<string, string> = {
  'unreviewed': 'Unreviewed',
  'under-review': 'Under Review',
  'validating': 'Validating',
  'archived': 'Archived',
}

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

function onCommentInput() {
  scheduleSave()
}

function onBodyInput(e: Event) {
  editBody.value = (e.target as HTMLTextAreaElement).value
  scheduleSave()
}

function onSummaryInput(e: Event) {
  editSummary.value = (e.target as HTMLInputElement).value
  scheduleSave()
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
  <div v-if="!detail" class="flex items-center justify-center h-full text-gray-400 text-sm">
    Select an idea to view details
  </div>
  <div v-else class="flex flex-col h-full">
    <!-- Fixed top: actions -->
    <div class="shrink-0 border-b border-gray-200 bg-white p-4 space-y-3">
      <!-- Conflict warning -->
      <div v-if="hasConflict" class="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
        <AlertTriangle class="h-4 w-4 shrink-0" />
        <span class="flex-1">File has been modified externally.</span>
        <button @click="reload" class="flex items-center gap-1 rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700">
          <RotateCcw class="h-3 w-3" /> Reload
        </button>
      </div>

      <!-- Score + save -->
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500">My Score</span>
            <ScoreInput :model-value="editScore" @update:model-value="onScoreChange" />
          </div>
          <div class="flex items-center gap-2" v-if="detail.frontmatter.llm_score">
            <span class="text-xs text-gray-500">LLM</span>
            <ScoreInput :model-value="detail.frontmatter.llm_score" readonly size="sm" />
          </div>
          <div v-if="detail.frontmatter.author" class="text-xs text-gray-400">
            by {{ detail.frontmatter.author }}
          </div>
        </div>
        <button
          v-if="!hasConflict"
          @click="immediateSave"
          :disabled="saving"
          class="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          <Save class="h-3.5 w-3.5" />
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>

      <!-- Category buttons -->
      <div class="flex gap-1.5 flex-wrap">
        <button
          v-for="cat in categories" :key="cat"
          @click="moveToCategory(cat)"
          :class="[
            'rounded-full px-3 py-1 text-xs font-medium transition',
            cat === detail.category
              ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          ]"
        >
          {{ categoryLabels[cat] }}
        </button>
      </div>

      <!-- Comment -->
      <textarea
        v-model="editComment"
        @input="onCommentInput"
        placeholder="Your review comment..."
        rows="3"
        class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
        style="max-height: 50vh; overflow-y: auto"
      />
    </div>

    <!-- Scrollable bottom: content -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- Summary -->
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">Summary</label>
        <input
          :value="editSummary"
          @input="onSummaryInput"
          class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
          placeholder="One-line summary..."
        />
      </div>

      <!-- Tags -->
      <div v-if="detail.frontmatter.tags?.length" class="flex flex-wrap gap-1.5">
        <span
          v-for="tag in detail.frontmatter.tags" :key="tag"
          class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600"
        >
          {{ tag }}
        </span>
      </div>

      <!-- Timestamps -->
      <div class="flex gap-4 text-xs text-gray-400">
        <span>Created: {{ detail.frontmatter.create_time?.slice(0, 19) }}</span>
        <span>Updated: {{ detail.frontmatter.update_time?.slice(0, 19) }}</span>
      </div>

      <!-- Body editor / preview -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="text-xs font-medium text-gray-500">Content</label>
          <button
            @click="editing = !editing"
            class="text-xs text-indigo-600 hover:text-indigo-800"
          >
            {{ editing ? 'Preview' : 'Edit' }}
          </button>
        </div>
        <textarea
          v-if="editing"
          :value="editBody"
          @input="onBodyInput"
          class="w-full min-h-[300px] rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-y"
        />
        <div v-else class="prose prose-sm max-w-none rounded-lg border border-gray-100 bg-gray-50/50 p-4">
          <MarkdownContent :content="editBody" />
        </div>
      </div>
    </div>
  </div>
</template>
