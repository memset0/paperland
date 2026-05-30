<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { Upload, Copy, Trash2, Link2 } from '@lucide/vue'
import { useImagesStore } from '@/stores/images'
import { imageFromClipboard } from '@/utils/uploadImage'
import AppPage from '@/components/AppPage.vue'
import type { ImageWithUrl } from '@paperland/shared'

const store = useImagesStore()
const { images, loading } = storeToRefs(store)

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

onMounted(() => {
  store.fetchImages()
  window.addEventListener('paste', onPaste)
})
onUnmounted(() => {
  window.removeEventListener('paste', onPaste)
})

/** Upload one or more files (from the picker, drop, or paste). */
async function uploadFiles(files: File[] | FileList) {
  const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
  if (list.length === 0) return
  uploading.value = true
  try {
    for (const file of list) {
      await store.upload(file, file.name)
    }
    toast.success(list.length > 1 ? `${list.length} images uploaded` : 'Image uploaded')
  } catch {
    toast.error('Upload failed')
  } finally {
    uploading.value = false
  }
}

function onPickFiles(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) uploadFiles(input.files)
  input.value = '' // allow re-selecting the same file
}

function onPaste(e: ClipboardEvent) {
  const file = imageFromClipboard(e)
  if (file) {
    e.preventDefault()
    uploadFiles([file])
  }
}

const dragOver = ref(false)
function onDrop(e: DragEvent) {
  dragOver.value = false
  if (e.dataTransfer?.files?.length) uploadFiles(e.dataTransfer.files)
}

async function copyLink(img: ImageWithUrl) {
  try {
    await navigator.clipboard.writeText(store.absoluteUrl(img.url))
    toast.success('Link copied')
  } catch {
    toast.error('Failed to copy link')
  }
}

async function copyMarkdown(img: ImageWithUrl) {
  try {
    await navigator.clipboard.writeText(`![${img.original_name ?? ''}](${img.url})`)
    toast.success('Markdown copied')
  } catch {
    toast.error('Failed to copy')
  }
}

async function remove(img: ImageWithUrl) {
  const warn = img.reference_count && img.reference_count > 0
    ? `This image is referenced by ${img.reference_count} note${img.reference_count > 1 ? 's' : ''}. Deleting it will break those references. Continue?`
    : 'Delete this image?'
  if (!confirm(warn)) return
  try {
    await store.deleteImage(img.hash)
    toast.success('Image deleted')
  } catch {
    toast.error('Delete failed')
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString()
}
</script>

<template>
  <AppPage>
    <p class="text-muted-foreground -mt-2 mb-4 text-sm">
      Upload images and reference them from notes. Anyone with a link can view; only logged-in users can upload.
    </p>

    <!-- Upload area: click to pick, drag-drop, or Ctrl+V paste anywhere on this page -->
    <div
      class="border-2 border-dashed rounded-lg p-8 mb-6 text-center cursor-pointer transition-colors"
      :class="dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'"
      @click="fileInput?.click()"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <input ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="onPickFiles" />
      <Upload class="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
      <p class="text-sm">
        <span class="font-medium text-primary">Click to upload</span>, drag &amp; drop, or paste (Ctrl+V)
      </p>
      <p class="text-xs text-muted-foreground mt-1">PNG, JPEG, GIF, WebP</p>
      <p v-if="uploading" class="text-xs text-primary mt-2">Uploading…</p>
    </div>

    <!-- Image grid -->
    <div v-if="loading" class="text-center text-muted-foreground py-12">Loading…</div>
    <div v-else-if="images.length === 0" class="text-center text-muted-foreground py-12">
      No images yet. Upload one above to get started.
    </div>
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      <div v-for="img in images" :key="img.hash" class="bg-card border rounded-lg overflow-hidden flex flex-col">
        <a :href="img.url" target="_blank" rel="noopener noreferrer" class="block aspect-square bg-muted/40">
          <img :src="img.url" :alt="img.original_name ?? img.hash" loading="lazy" class="w-full h-full object-contain" />
        </a>
        <div class="p-3 flex flex-col gap-1 text-xs">
          <div class="font-medium truncate" :title="img.original_name ?? ''">
            {{ img.original_name || '(unnamed)' }}
          </div>
          <div class="text-muted-foreground flex flex-wrap gap-x-2">
            <span>{{ formatSize(img.size) }}</span>
            <span v-if="img.width && img.height">{{ img.width }}×{{ img.height }}</span>
            <span>{{ img.ext.toUpperCase() }}</span>
          </div>
          <div class="text-muted-foreground flex items-center justify-between">
            <span>{{ formatDate(img.created_at) }}</span>
            <span
              class="px-1.5 py-0.5 rounded"
              :class="img.reference_count ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'"
              :title="`Referenced by ${img.reference_count ?? 0} note(s)`"
            >
              {{ img.reference_count ?? 0 }} ref
            </span>
          </div>
          <div class="flex items-center gap-1 mt-1">
            <button class="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 border rounded hover:bg-muted" title="Copy link" @click="copyLink(img)">
              <Link2 class="h-3.5 w-3.5" /> Link
            </button>
            <button class="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 border rounded hover:bg-muted" title="Copy Markdown" @click="copyMarkdown(img)">
              <Copy class="h-3.5 w-3.5" /> MD
            </button>
            <button class="p-1 border rounded text-destructive hover:bg-muted" title="Delete" @click="remove(img)">
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppPage>
</template>
