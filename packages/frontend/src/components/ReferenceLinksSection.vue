<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { Link2, Plus, Pencil, Trash2, ExternalLink, Loader2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { referenceLinksApi } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import type { PaperReferenceLink } from '@paperland/shared'

const props = defineProps<{ paperId: number }>()

const auth = useAuthStore()

const links = ref<PaperReferenceLink[]>([])
const loading = ref(false)

// One shared form drives both "add" and "edit": editingId === null while adding,
// or the link's id while editing. The form is open whenever `adding` or `editingId`.
// The user types a url (required) and an optional title; the description is auto-derived
// server-side from the page <title> (read-only — never hand-typed).
const adding = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const error = ref('')
const form = reactive({ url: '', title: '' })

// Auto-derived description preview state.
const previewLoading = ref(false)
const previewDescription = ref<string | null>(null)
const lastPreviewedUrl = ref('') // url whose preview is currently reflected (skip re-crawl)
let previewSeq = 0 // guards against out-of-order preview responses
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const showForm = computed(() => adding.value || editingId.value !== null)

// Display label resolves the fallback chain title → description → url.
function displayLabel(link: PaperReferenceLink): string {
  return link.title || link.description || link.url
}

function isHttpUrl(u: string): boolean {
  try {
    const p = new URL(u)
    return p.protocol === 'http:' || p.protocol === 'https:'
  } catch {
    return false
  }
}

async function load() {
  loading.value = true
  try {
    const res = await referenceLinksApi.getForPaper(props.paperId)
    links.value = res.data
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.url = ''
  form.title = ''
  previewDescription.value = null
  lastPreviewedUrl.value = ''
  previewLoading.value = false
  error.value = ''
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
}

function startAdd() {
  editingId.value = null
  resetForm()
  adding.value = true
}

function startEdit(link: PaperReferenceLink) {
  adding.value = false
  editingId.value = link.id
  resetForm()
  form.url = link.url
  form.title = link.title ?? ''
  // Keep the existing description; only re-crawl if the user changes the url.
  previewDescription.value = link.description
  lastPreviewedUrl.value = link.url
}

function cancel() {
  adding.value = false
  editingId.value = null
  resetForm()
}

// Crawl the url and reflect the derived description. Never throws; a failed crawl leaves
// a null description (the link still saves on the url alone).
async function doPreview(url: string) {
  if (!isHttpUrl(url)) {
    previewDescription.value = null
    lastPreviewedUrl.value = url
    return
  }
  const seq = ++previewSeq
  previewLoading.value = true
  try {
    const res = await referenceLinksApi.preview(url)
    if (seq !== previewSeq) return // superseded by a newer preview
    previewDescription.value = res.data.description
    lastPreviewedUrl.value = url
  } catch {
    if (seq !== previewSeq) return
    previewDescription.value = null
    lastPreviewedUrl.value = url
  } finally {
    if (seq === previewSeq) previewLoading.value = false
  }
}

// Debounced auto-preview as the user types/edits the url.
watch(() => form.url, (val) => {
  const url = val.trim()
  if (debounceTimer) clearTimeout(debounceTimer)
  if (!isHttpUrl(url) || url === lastPreviewedUrl.value) return
  debounceTimer = setTimeout(() => doPreview(url), 500)
})

async function save() {
  const url = form.url.trim()
  if (!url) { error.value = '请填写链接'; return }
  if (!isHttpUrl(url)) { error.value = '请填写有效的 http(s) 链接'; return }

  saving.value = true
  error.value = ''
  try {
    // Make sure the description reflects the current url before persisting.
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
    if (url !== lastPreviewedUrl.value) await doPreview(url)

    const payload = { url, title: form.title.trim() || null, description: previewDescription.value }
    if (editingId.value !== null) {
      const res = await referenceLinksApi.update(editingId.value, payload)
      const idx = links.value.findIndex((l) => l.id === editingId.value)
      if (idx !== -1) links.value[idx] = res.data
    } else {
      const res = await referenceLinksApi.create(props.paperId, payload)
      links.value.push(res.data)
    }
    cancel()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function remove(link: PaperReferenceLink) {
  if (!window.confirm(`确认删除参考链接「${displayLabel(link)}」？`)) return
  await referenceLinksApi.remove(link.id)
  links.value = links.value.filter((l) => l.id !== link.id)
  if (editingId.value === link.id) cancel()
}

onMounted(load)
watch(() => props.paperId, load)
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
      <Link2 class="h-3 w-3" /> 参考链接
      <Button v-if="auth.isAuthenticated && !showForm" variant="ghost" size="icon-xs" class="ml-auto" @click="startAdd">
        <Plus />
      </Button>
    </div>

    <ul v-if="links.length" class="space-y-1.5">
      <li
        v-for="link in links"
        :key="link.id"
        class="group flex items-start gap-1.5"
        :class="{ 'opacity-60': editingId === link.id }"
      >
        <div class="min-w-0 flex-1">
          <a
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-sm text-primary hover:underline break-all"
          >
            {{ displayLabel(link) }}
            <ExternalLink class="h-3 w-3 shrink-0" />
          </a>
          <p v-if="link.title && link.description" class="text-xs text-muted-foreground leading-snug">{{ link.description }}</p>
        </div>
        <div v-if="auth.isAuthenticated" class="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity hover:opacity-100 group-hover:opacity-100">
          <Button variant="ghost" size="icon-xs" title="编辑" @click="startEdit(link)">
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon-xs" title="删除" @click="remove(link)">
            <Trash2 />
          </Button>
        </div>
      </li>
    </ul>

    <div v-if="showForm" class="space-y-1.5 rounded-md border p-2">
      <Input v-model="form.url" placeholder="https://...（必填）" class="h-8 text-sm" @keyup.enter="save" />
      <Input v-model="form.title" placeholder="标题（可选，留空则用自动获取的描述）" class="h-8 text-sm" @keyup.enter="save" />
      <div class="flex min-h-4 items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 v-if="previewLoading" class="h-3 w-3 shrink-0 animate-spin" />
        <span v-if="previewLoading">正在获取描述…</span>
        <span v-else-if="previewDescription" class="break-all">{{ previewDescription }}</span>
        <span v-else-if="form.url.trim()" class="italic opacity-70">无法自动获取描述（站点可能禁止抓取），可手动填写标题</span>
      </div>
      <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
      <div class="flex gap-2">
        <Button size="sm" :disabled="saving" @click="save">
          <Loader2 v-if="saving" class="animate-spin" />
          {{ saving ? '保存中...' : '保存' }}
        </Button>
        <Button variant="ghost" size="sm" :disabled="saving" @click="cancel">取消</Button>
      </div>
    </div>

    <Button v-else-if="auth.isAuthenticated && !links.length" variant="link" size="xs" @click="startAdd">+ 添加链接</Button>
  </div>
</template>
