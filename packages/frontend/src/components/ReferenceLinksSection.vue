<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { Link2, Plus, Pencil, Trash2, ExternalLink, Loader2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { referenceLinksApi } from '@/api/client'
import type { PaperReferenceLink } from '@paperland/shared'

const props = defineProps<{ paperId: number }>()

const links = ref<PaperReferenceLink[]>([])
const loading = ref(false)

// One shared form drives both "add" and "edit": editingId === null while adding,
// or the link's id while editing. The form is open whenever `adding` or `editingId`.
const adding = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const error = ref('')
const form = reactive({ title: '', url: '', description: '' })

const showForm = computed(() => adding.value || editingId.value !== null)

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
  form.title = ''
  form.url = ''
  form.description = ''
  error.value = ''
}

function startAdd() {
  editingId.value = null
  resetForm()
  adding.value = true
}

function startEdit(link: PaperReferenceLink) {
  adding.value = false
  editingId.value = link.id
  form.title = link.title
  form.url = link.url
  form.description = link.description ?? ''
  error.value = ''
}

function cancel() {
  adding.value = false
  editingId.value = null
  resetForm()
}

async function save() {
  const title = form.title.trim()
  const url = form.url.trim()
  if (!title) { error.value = '请填写标题'; return }
  if (!url) { error.value = '请填写链接'; return }

  saving.value = true
  error.value = ''
  try {
    const payload = { title, url, description: form.description.trim() || null }
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
      <Button v-if="!showForm" variant="ghost" size="icon-xs" class="ml-auto" @click="startAdd">
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
            {{ link.title }}
            <ExternalLink class="h-3 w-3 shrink-0" />
          </a>
          <p v-if="link.description" class="text-xs text-muted-foreground leading-snug">{{ link.description }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
      <Input v-model="form.title" placeholder="标题" class="h-8 text-sm" @keyup.enter="save" />
      <Input v-model="form.url" placeholder="https://..." class="h-8 text-sm" @keyup.enter="save" />
      <Input v-model="form.description" placeholder="描述(可选)" class="h-8 text-sm" @keyup.enter="save" />
      <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
      <div class="flex gap-2">
        <Button size="sm" :disabled="saving" @click="save">
          <Loader2 v-if="saving" class="animate-spin" />
          {{ saving ? '保存中...' : '保存' }}
        </Button>
        <Button variant="ghost" size="sm" :disabled="saving" @click="cancel">取消</Button>
      </div>
    </div>

    <Button v-else-if="!links.length" variant="link" size="xs" @click="startAdd">+ 添加链接</Button>
  </div>
</template>
