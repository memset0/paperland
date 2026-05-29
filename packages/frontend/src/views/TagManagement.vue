<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Pencil, Trash2, Tag, Check, X, Eye, EyeOff, Loader2 } from '@lucide/vue'
import { useTagsStore, type TagWithCount } from '@/stores/tags'
import { TAG_COLOR_PALETTE } from '@/utils/tag-colors'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

const tagsStore = useTagsStore()
const loading = ref(true)

const editingId = ref<number | null>(null)
const editingName = ref('')
const renameError = ref('')

const showMergeDialog = ref(false)
const mergeSource = ref<TagWithCount | null>(null)
const mergeTarget = ref<{ id: number; name: string; color: string } | null>(null)
const merging = ref(false)

const showDeleteDialog = ref(false)
const deletingTag = ref<TagWithCount | null>(null)
const deleting = ref(false)

const sortedTags = computed(() => [...tagsStore.tags].sort((a, b) => a.name.localeCompare(b.name)))

onMounted(async () => {
  await tagsStore.fetchTags()
  loading.value = false
})

function startRename(tag: TagWithCount) {
  editingId.value = tag.id
  editingName.value = tag.name
  renameError.value = ''
}

function cancelRename() {
  editingId.value = null
  editingName.value = ''
  renameError.value = ''
}

async function confirmRename() {
  if (!editingId.value || !editingName.value.trim()) return
  const name = editingName.value.trim()
  const tag = tagsStore.tags.find(t => t.id === editingId.value)
  if (!tag || name === tag.name) { cancelRename(); return }

  try {
    const res = await tagsStore.renameTag(editingId.value, name)
    if ('error' in res && (res as any).error?.code === 'TAG_NAME_CONFLICT') {
      mergeSource.value = tag
      mergeTarget.value = (res as any).target_tag
      showMergeDialog.value = true
      return
    }
    await tagsStore.fetchTags()
    cancelRename()
  } catch (err: any) {
    renameError.value = err?.message || '重命名失败'
  }
}

async function confirmMerge() {
  if (!mergeSource.value || !mergeTarget.value) return
  merging.value = true
  try {
    await tagsStore.mergeTag(mergeSource.value.id, mergeTarget.value.id)
    showMergeDialog.value = false
    mergeSource.value = null
    mergeTarget.value = null
    cancelRename()
  } finally {
    merging.value = false
  }
}

function startDelete(tag: TagWithCount) {
  deletingTag.value = tag
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!deletingTag.value) return
  deleting.value = true
  try {
    await tagsStore.deleteTag(deletingTag.value.id)
    showDeleteDialog.value = false
    deletingTag.value = null
  } finally {
    deleting.value = false
  }
}

async function setColor(tagId: number, color: string) {
  await tagsStore.updateTagColor(tagId, color)
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
    <div class="mb-6">
      <h1 class="flex items-center gap-2 text-xl font-bold">
        <Tag class="h-5 w-5 text-primary" />
        标签管理
      </h1>
      <p class="mt-1 text-sm text-muted-foreground">管理所有标签 — 重命名、合并、删除、修改颜色</p>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16">
      <Loader2 class="h-6 w-6 animate-spin text-primary" />
    </div>

    <Card v-else-if="sortedTags.length === 0" class="p-12 text-center text-muted-foreground">
      <Tag class="mx-auto h-10 w-10 stroke-1" />
      <p class="mt-3 text-sm">暂无标签</p>
      <p class="mt-1 text-xs">在添加论文时创建标签，或通过 Zotero 同步</p>
    </Card>

    <div v-else class="space-y-1">
      <Card
        v-for="tag in sortedTags" :key="tag.id"
        class="group flex-row items-center gap-3 px-4 py-3 transition hover:shadow-sm"
      >
        <Popover>
          <PopoverTrigger as-child>
            <button
              class="relative h-5 w-5 shrink-0 rounded-full ring-2 ring-background shadow-sm transition hover:scale-110"
              :style="{ backgroundColor: tag.color || 'var(--muted-foreground)' }"
              :aria-label="`修改 ${tag.name} 颜色`"
            />
          </PopoverTrigger>
          <PopoverContent class="w-auto p-2">
            <div class="grid grid-cols-5 gap-1.5">
              <button
                v-for="c in TAG_COLOR_PALETTE" :key="c"
                @click="setColor(tag.id, c)"
                class="h-6 w-6 rounded-full transition hover:scale-110 ring-1 ring-black/5"
                :class="c === tag.color ? 'ring-2 ring-ring ring-offset-1' : ''"
                :style="{ backgroundColor: c }"
              />
            </div>
          </PopoverContent>
        </Popover>

        <div class="flex-1 min-w-0">
          <template v-if="editingId === tag.id">
            <div class="flex items-center gap-2">
              <Input
                v-model="editingName"
                @keydown.enter="confirmRename"
                @keydown.escape="cancelRename"
                autofocus
                class="h-7"
              />
              <Button variant="ghost" size="icon-sm" @click="confirmRename">
                <Check />
              </Button>
              <Button variant="ghost" size="icon-sm" @click="cancelRename">
                <X />
              </Button>
            </div>
            <p v-if="renameError" class="mt-1 text-xs text-destructive">{{ renameError }}</p>
          </template>
          <template v-else>
            <span class="text-sm font-medium">{{ tag.name }}</span>
          </template>
        </div>

        <Badge variant="secondary" class="shrink-0">{{ tag.paper_count }} 篇</Badge>
        <span class="shrink-0 text-xs text-muted-foreground/60 font-mono">#{{ tag.id }}</span>

        <Button
          variant="ghost" size="icon-sm"
          :class="tag.visible ? 'opacity-0 group-hover:opacity-100' : ''"
          :title="tag.visible ? '隐藏标签' : '显示标签'"
          @click="tagsStore.toggleVisibility(tag.id)"
        >
          <Eye v-if="tag.visible" />
          <EyeOff v-else />
        </Button>

        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <Button variant="ghost" size="icon-sm" title="重命名" @click="startRename(tag)">
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon-sm" class="hover:text-destructive" title="删除" @click="startDelete(tag)">
            <Trash2 />
          </Button>
        </div>
      </Card>
    </div>

    <Dialog v-model:open="showMergeDialog">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>合并标签</DialogTitle>
          <DialogDescription>
            标签 <strong>"{{ mergeSource?.name }}"</strong> 将合并到已存在的标签
            <strong>"{{ mergeTarget?.name }}"</strong>。
            所有关联的论文将被迁移到目标标签。此操作不可撤销。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" @click="showMergeDialog = false; cancelRename()">取消</Button>
          <Button :disabled="merging" @click="confirmMerge">
            {{ merging ? '合并中...' : '确认合并' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showDeleteDialog">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>删除标签</DialogTitle>
          <DialogDescription>
            确定删除标签 <strong>"{{ deletingTag?.name }}"</strong>？
            <template v-if="deletingTag?.paper_count">
              当前有 {{ deletingTag.paper_count }} 篇论文使用此标签，删除后这些论文将不再关联此标签。
            </template>
            此操作不可撤销。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" @click="showDeleteDialog = false">取消</Button>
          <Button variant="destructive" :disabled="deleting" @click="confirmDelete">
            {{ deleting ? '删除中...' : '确认删除' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
