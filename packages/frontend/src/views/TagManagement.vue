<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Pencil, Trash2, Tag, Check, X, Eye, EyeOff } from 'lucide-vue-next'
import { useTagsStore, type TagWithCount } from '@/stores/tags'
import { TAG_COLOR_PALETTE } from '@/utils/tag-colors'

const tagsStore = useTagsStore()
const loading = ref(true)

// Rename state
const editingId = ref<number | null>(null)
const editingName = ref('')
const renameError = ref('')

// Merge confirmation
const showMergeDialog = ref(false)
const mergeSource = ref<TagWithCount | null>(null)
const mergeTarget = ref<{ id: number; name: string; color: string } | null>(null)
const merging = ref(false)

// Delete confirmation
const showDeleteDialog = ref(false)
const deletingTag = ref<TagWithCount | null>(null)
const deleting = ref(false)

// Color picker
const colorPickerId = ref<number | null>(null)

const sortedTags = computed(() => {
  return [...tagsStore.tags].sort((a, b) => a.name.localeCompare(b.name))
})

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
      // Show merge dialog
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

function toggleColorPicker(tagId: number) {
  colorPickerId.value = colorPickerId.value === tagId ? null : tagId
}

async function setColor(tagId: number, color: string) {
  await tagsStore.updateTagColor(tagId, color)
  colorPickerId.value = null
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="flex items-center gap-2 text-xl font-bold text-gray-900">
        <Tag class="h-5 w-5 text-indigo-600" />
        标签管理
      </h1>
      <p class="mt-1 text-sm text-gray-500">管理所有标签 — 重命名、合并、删除、修改颜色</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="sortedTags.length === 0" class="rounded-xl border border-gray-200 bg-white p-12 text-center">
      <Tag class="mx-auto h-10 w-10 text-gray-300" />
      <p class="mt-3 text-sm text-gray-500">暂无标签</p>
      <p class="mt-1 text-xs text-gray-400">在添加论文时创建标签，或通过 Zotero 同步</p>
    </div>

    <!-- Tag list -->
    <div v-else class="space-y-1">
      <div
        v-for="tag in sortedTags" :key="tag.id"
        class="group flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-4 py-3 transition hover:border-gray-200 hover:shadow-sm"
      >
        <!-- Color swatch -->
        <button
          @click="toggleColorPicker(tag.id)"
          class="relative h-5 w-5 shrink-0 rounded-full ring-2 ring-white shadow-sm transition hover:scale-110"
          :style="{ backgroundColor: tag.color || '#6b7280' }"
        >
          <!-- Color picker dropdown -->
          <div
            v-if="colorPickerId === tag.id"
            class="absolute left-0 top-full mt-2 z-50 rounded-lg bg-white border border-gray-200 shadow-xl p-2"
            @click.stop
          >
            <div class="grid grid-cols-5 gap-1.5 w-[140px]">
              <button
                v-for="c in TAG_COLOR_PALETTE" :key="c"
                @click="setColor(tag.id, c)"
                class="h-6 w-6 rounded-full transition hover:scale-110 ring-1 ring-black/5"
                :class="c === tag.color ? 'ring-2 ring-indigo-500 ring-offset-1' : ''"
                :style="{ backgroundColor: c }"
              />
            </div>
          </div>
        </button>

        <!-- Name (inline edit) -->
        <div class="flex-1 min-w-0">
          <template v-if="editingId === tag.id">
            <div class="flex items-center gap-2">
              <input
                v-model="editingName"
                @keydown.enter="confirmRename"
                @keydown.escape="cancelRename"
                class="flex-1 rounded border border-indigo-300 px-2 py-0.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                ref="renameInput"
                autofocus
              />
              <button @click="confirmRename" class="rounded p-1 text-green-600 hover:bg-green-50 transition">
                <Check class="h-4 w-4" />
              </button>
              <button @click="cancelRename" class="rounded p-1 text-gray-400 hover:bg-gray-50 transition">
                <X class="h-4 w-4" />
              </button>
            </div>
            <p v-if="renameError" class="mt-1 text-xs text-red-500">{{ renameError }}</p>
          </template>
          <template v-else>
            <span class="text-sm font-medium text-gray-900">{{ tag.name }}</span>
          </template>
        </div>

        <!-- Paper count -->
        <span class="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
          {{ tag.paper_count }} 篇
        </span>

        <!-- ID -->
        <span class="shrink-0 text-xs text-gray-300 font-mono">#{{ tag.id }}</span>

        <!-- Visibility toggle (always visible for hidden tags) -->
        <button @click="tagsStore.toggleVisibility(tag.id)" :class="['rounded p-1.5 transition', tag.visible ? 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 opacity-0 group-hover:opacity-100' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500']" :title="tag.visible ? '隐藏标签' : '显示标签'">
          <Eye v-if="tag.visible" class="h-3.5 w-3.5" />
          <EyeOff v-else class="h-3.5 w-3.5" />
        </button>

        <!-- Actions -->
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button @click="startRename(tag)" class="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition" title="重命名">
            <Pencil class="h-3.5 w-3.5" />
          </button>
          <button @click="startDelete(tag)" class="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition" title="删除">
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Merge Confirmation Dialog -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showMergeDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div class="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" @click.stop>
            <h3 class="text-lg font-semibold text-gray-900">合并标签</h3>
            <p class="mt-2 text-sm text-gray-600">
              标签 <strong>"{{ mergeSource?.name }}"</strong> 将合并到已存在的标签
              <strong>"{{ mergeTarget?.name }}"</strong>。
              所有关联的论文将被迁移到目标标签。此操作不可撤销。
            </p>
            <div class="mt-5 flex justify-end gap-3">
              <button @click="showMergeDialog = false; cancelRename()" class="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 transition">取消</button>
              <button @click="confirmMerge" :disabled="merging" class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition">
                {{ merging ? '合并中...' : '确认合并' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirmation Dialog -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showDeleteDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div class="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" @click.stop>
            <h3 class="text-lg font-semibold text-gray-900">删除标签</h3>
            <p class="mt-2 text-sm text-gray-600">
              确定删除标签 <strong>"{{ deletingTag?.name }}"</strong>？
              <template v-if="deletingTag?.paper_count">
                当前有 {{ deletingTag.paper_count }} 篇论文使用此标签，删除后这些论文将不再关联此标签。
              </template>
              此操作不可撤销。
            </p>
            <div class="mt-5 flex justify-end gap-3">
              <button @click="showDeleteDialog = false" class="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 transition">取消</button>
              <button @click="confirmDelete" :disabled="deleting" class="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 transition">
                {{ deleting ? '删除中...' : '确认删除' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
