<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  Pencil, Trash2, Tag, Check, X, Eye, EyeOff, Loader2,
  Plus, Search, MoreHorizontal, Palette, ChevronUp, ChevronDown, ArrowUpDown,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useTagsStore, type TagWithCount } from '@/stores/tags'
import { TAG_COLOR_PALETTE, randomTagColor } from '@/utils/tag-colors'
import TagBadge from '@/components/TagBadge.vue'
import AppPage from '@/components/AppPage.vue'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const tagsStore = useTagsStore()
const loading = ref(true)

// search + sort
const query = ref('')
type SortKey = 'name' | 'paper_count' | 'id'
const sortKey = ref<SortKey>('name')
const sortDir = ref<'asc' | 'desc'>('asc')

// inline rename
const editingId = ref<number | null>(null)
const editingName = ref('')
const renameError = ref('')

// inline create
const creating = ref(false)
const newName = ref('')
const newColor = ref('')
const savingNew = ref(false)

// merge / delete dialogs
const showMergeDialog = ref(false)
const mergeSource = ref<TagWithCount | null>(null)
const mergeTarget = ref<{ id: number; name: string; color: string } | null>(null)
const merging = ref(false)
const showDeleteDialog = ref(false)
const deletingTag = ref<TagWithCount | null>(null)
const deleting = ref(false)

const hasTags = computed(() => tagsStore.tags.length > 0)
const visibleCount = computed(() => tagsStore.tags.filter(t => t.visible).length)

const displayTags = computed(() => {
  const q = query.value.trim().toLowerCase()
  const dir = sortDir.value === 'asc' ? 1 : -1
  return tagsStore.tags
    .filter(t => !q || t.name.toLowerCase().includes(q))
    .slice()
    .sort((a, b) => {
      if (sortKey.value === 'name') return a.name.localeCompare(b.name) * dir
      if (sortKey.value === 'paper_count') return (a.paper_count - b.paper_count) * dir
      return (a.id - b.id) * dir
    })
})

function sortIcon(key: SortKey) {
  if (sortKey.value !== key) return ArrowUpDown
  return sortDir.value === 'asc' ? ChevronUp : ChevronDown
}

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

onMounted(async () => {
  await tagsStore.fetchTags()
  loading.value = false
})

// — create —
function startCreate() {
  creating.value = true
  newName.value = ''
  newColor.value = randomTagColor()
}
function cancelCreate() {
  creating.value = false
  newName.value = ''
}
async function confirmCreate() {
  const name = newName.value.trim()
  if (!name || savingNew.value) return
  savingNew.value = true
  try {
    const res = await tagsStore.createTag(name, newColor.value)
    if (res && 'error' in res && (res as any).error?.code === 'TAG_NAME_CONFLICT') {
      toast.error(`Tag “${name}” already exists`)
      return
    }
    toast.success(`Created tag “${name}”`)
    creating.value = false
    newName.value = ''
  } catch (err: any) {
    toast.error(err?.message || 'Failed to create tag')
  } finally {
    savingNew.value = false
  }
}

// — rename —
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
    toast.success(`Renamed to “${name}”`)
    cancelRename()
  } catch (err: any) {
    renameError.value = err?.message || 'Failed to rename'
    toast.error(renameError.value)
  }
}

// — merge —
async function confirmMerge() {
  if (!mergeSource.value || !mergeTarget.value) return
  merging.value = true
  const targetName = mergeTarget.value.name
  try {
    await tagsStore.mergeTag(mergeSource.value.id, mergeTarget.value.id)
    toast.success(`Merged into “${targetName}”`)
    showMergeDialog.value = false
    mergeSource.value = null
    mergeTarget.value = null
    cancelRename()
  } catch (err: any) {
    toast.error(err?.message || 'Failed to merge')
  } finally {
    merging.value = false
  }
}

// — delete —
function startDelete(tag: TagWithCount) {
  deletingTag.value = tag
  showDeleteDialog.value = true
}
async function confirmDelete() {
  if (!deletingTag.value) return
  deleting.value = true
  const name = deletingTag.value.name
  try {
    await tagsStore.deleteTag(deletingTag.value.id)
    toast.success(`Deleted tag “${name}”`)
    showDeleteDialog.value = false
    deletingTag.value = null
  } catch (err: any) {
    toast.error(err?.message || 'Failed to delete')
  } finally {
    deleting.value = false
  }
}

// — color —
async function setColor(tagId: number, color: string) {
  await tagsStore.updateTagColor(tagId, color)
}
</script>

<template>
  <AppPage>
    <template #actions>
      <Button size="sm" :disabled="creating" @click="startCreate">
        <Plus /> New
      </Button>
    </template>

    <!-- loading -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <Loader2 class="h-6 w-6 animate-spin text-primary" />
    </div>

    <!-- no tags at all -->
    <Card v-else-if="!hasTags && !creating" class="p-12 text-center text-muted-foreground">
      <Tag class="mx-auto h-10 w-10 stroke-1" />
      <p class="mt-3 text-sm">No tags yet</p>
      <p class="mt-1 text-xs">Create one with the New button, or while adding a paper</p>
    </Card>

    <template v-else>
      <!-- toolbar: search + visible/total stat -->
      <div class="mb-3 flex items-center gap-3">
        <div class="relative w-full max-w-xs">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="query" placeholder="Search tags…" class="h-8 pl-8" />
        </div>
        <span class="ml-auto shrink-0 text-xs text-muted-foreground">
          {{ visibleCount }} / {{ tagsStore.tags.length }} visible
        </span>
      </div>

      <Card class="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-16 text-center">Visible</TableHead>
              <TableHead class="w-20">
                <button class="-ml-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground" @click="toggleSort('id')">
                  ID <component :is="sortIcon('id')" :class="['size-3.5', sortKey === 'id' ? 'text-foreground' : 'opacity-40']" />
                </button>
              </TableHead>
              <TableHead>
                <button class="-ml-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground" @click="toggleSort('name')">
                  Name <component :is="sortIcon('name')" :class="['size-3.5', sortKey === 'name' ? 'text-foreground' : 'opacity-40']" />
                </button>
              </TableHead>
              <TableHead class="w-28 text-right">
                <button class="inline-flex items-center gap-1 rounded px-1 hover:text-foreground" @click="toggleSort('paper_count')">
                  Papers <component :is="sortIcon('paper_count')" :class="['size-3.5', sortKey === 'paper_count' ? 'text-foreground' : 'opacity-40']" />
                </button>
              </TableHead>
              <TableHead class="w-12"></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            <!-- inline create row -->
            <TableRow v-if="creating" class="bg-muted/40">
              <TableCell />
              <TableCell />
              <TableCell>
                <div class="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger as-child>
                      <button
                        class="size-5 shrink-0 rounded-full shadow-sm ring-2 ring-background transition hover:scale-110"
                        :style="{ backgroundColor: newColor }"
                        aria-label="Pick color"
                      />
                    </PopoverTrigger>
                    <PopoverContent class="w-auto p-2">
                      <div class="grid grid-cols-5 gap-1.5">
                        <button
                          v-for="c in TAG_COLOR_PALETTE" :key="c"
                          class="size-6 rounded-full ring-1 ring-black/5 transition hover:scale-110"
                          :class="c === newColor ? 'ring-2 ring-ring ring-offset-1' : ''"
                          :style="{ backgroundColor: c }"
                          @click="newColor = c"
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Input
                    v-model="newName"
                    autofocus
                    placeholder="Tag name…"
                    class="h-7 max-w-xs"
                    @keydown.enter="confirmCreate"
                    @keydown.escape="cancelCreate"
                  />
                </div>
              </TableCell>
              <TableCell />
              <TableCell>
                <div class="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon-sm" :disabled="!newName.trim() || savingNew" title="Create" @click="confirmCreate">
                    <Loader2 v-if="savingNew" class="animate-spin" />
                    <Check v-else />
                  </Button>
                  <Button variant="ghost" size="icon-sm" title="Cancel" @click="cancelCreate">
                    <X />
                  </Button>
                </div>
              </TableCell>
            </TableRow>

            <!-- data rows -->
            <TableRow v-for="tag in displayTags" :key="tag.id" class="group">
              <!-- visibility -->
              <TableCell class="text-center">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="ghost" size="icon-sm"
                      :class="tag.visible ? '' : 'text-muted-foreground/50'"
                      @click="tagsStore.toggleVisibility(tag.id)"
                    >
                      <Eye v-if="tag.visible" />
                      <EyeOff v-else />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{{ tag.visible ? 'Visible in filter bar (click to hide)' : 'Hidden (click to show)' }}</TooltipContent>
                </Tooltip>
              </TableCell>

              <!-- id -->
              <TableCell>
                <span class="font-mono text-xs text-muted-foreground/60">#{{ tag.id }}</span>
              </TableCell>

              <!-- name (true-color chip / inline edit) -->
              <TableCell>
                <template v-if="editingId === tag.id">
                  <div class="flex items-center gap-2">
                    <Input
                      v-model="editingName"
                      autofocus
                      class="h-7 max-w-xs"
                      @keydown.enter="confirmRename"
                      @keydown.escape="cancelRename"
                    />
                    <Button variant="ghost" size="icon-sm" @click="confirmRename"><Check /></Button>
                    <Button variant="ghost" size="icon-sm" @click="cancelRename"><X /></Button>
                  </div>
                  <p v-if="renameError" class="mt-1 text-xs text-destructive">{{ renameError }}</p>
                </template>
                <TagBadge v-else :tag-id="tag.id" :tag-name="tag.name" :color="tag.color" />
              </TableCell>

              <!-- paper count -->
              <TableCell class="text-right">
                <span class="text-sm tabular-nums text-muted-foreground">{{ tag.paper_count }}</span>
              </TableCell>

              <!-- actions -->
              <TableCell class="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" size="icon-sm" class="opacity-60 group-hover:opacity-100" title="More actions">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem @click="startRename(tag)">
                      <Pencil class="size-3.5" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Palette class="size-3.5" /> Change color
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <div class="grid grid-cols-5 gap-1.5 p-1">
                          <button
                            v-for="c in TAG_COLOR_PALETTE" :key="c"
                            class="size-6 rounded-full ring-1 ring-black/5 transition hover:scale-110"
                            :class="c === tag.color ? 'ring-2 ring-ring ring-offset-1' : ''"
                            :style="{ backgroundColor: c }"
                            @click="setColor(tag.id, c)"
                          />
                        </div>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem @click="tagsStore.toggleVisibility(tag.id)">
                      <component :is="tag.visible ? EyeOff : Eye" class="size-3.5" />
                      {{ tag.visible ? 'Hide' : 'Show' }}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" @click="startDelete(tag)">
                      <Trash2 class="size-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>

            <!-- no search matches -->
            <TableRow v-if="hasTags && displayTags.length === 0 && !creating" class="hover:bg-transparent">
              <TableCell colspan="5" class="py-10 text-center text-sm text-muted-foreground">
                No matching tags
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </template>

    <!-- merge confirmation -->
    <Dialog v-model:open="showMergeDialog">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Merge tags</DialogTitle>
          <DialogDescription>
            Tag <strong>"{{ mergeSource?.name }}"</strong> will be merged into the existing tag
            <strong>"{{ mergeTarget?.name }}"</strong>.
            All associated papers will be moved to the target tag. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" @click="showMergeDialog = false; cancelRename()">Cancel</Button>
          <Button :disabled="merging" @click="confirmMerge">
            {{ merging ? 'Merging…' : 'Confirm merge' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- delete confirmation -->
    <Dialog v-model:open="showDeleteDialog">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete tag</DialogTitle>
          <DialogDescription>
            Delete tag <strong>"{{ deletingTag?.name }}"</strong>?
            <template v-if="deletingTag?.paper_count">
              It is currently used by {{ deletingTag.paper_count }} paper(s); they will no longer be associated with this tag.
            </template>
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" @click="showDeleteDialog = false">Cancel</Button>
          <Button variant="destructive" :disabled="deleting" @click="confirmDelete">
            {{ deleting ? 'Deleting…' : 'Confirm delete' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </AppPage>
</template>
