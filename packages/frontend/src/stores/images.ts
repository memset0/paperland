import { defineStore } from 'pinia'
import { ref } from 'vue'
import { imagesApi } from '@/api/client'
import { uploadImage as uploadImageHelper, type UploadedImage } from '@/utils/uploadImage'
import type { ImageWithUrl } from '@paperland/shared'

export const useImagesStore = defineStore('images', () => {
  const images = ref<ImageWithUrl[]>([])
  const publicBaseUrl = ref('')
  const loading = ref(false)
  const loadingMore = ref(false)
  const total = ref(0)
  const nextOffset = ref<number | null>(null)
  const PAGE_SIZE = 48
  let generation = 0

  /** Load the first page (replacing the list). */
  async function fetchImages() {
    const n = ++generation
    loading.value = true
    try {
      const res = await imagesApi.page(PAGE_SIZE, 0)
      if (n !== generation) return
      images.value = res.data
      publicBaseUrl.value = res.public_base_url || ''
      total.value = res.total
      nextOffset.value = res.next_offset
    } finally {
      if (n === generation) loading.value = false
    }
  }

  /** Append the next page; no-op while loading or on the last page. */
  async function fetchMore() {
    if (nextOffset.value === null || loading.value || loadingMore.value) return
    const n = generation
    loadingMore.value = true
    try {
      const res = await imagesApi.page(PAGE_SIZE, nextOffset.value)
      if (n !== generation) return
      const seen = new Set(images.value.map((i) => i.hash))
      images.value.push(...res.data.filter((i) => !seen.has(i.hash)))
      total.value = res.total
      nextOffset.value = res.next_offset
    } finally {
      loadingMore.value = false
    }
  }

  /** Absolute URL for an image's relative `url`, using public_base_url or the page origin. */
  function absoluteUrl(relUrl: string): string {
    const base = (publicBaseUrl.value || window.location.origin).replace(/\/$/, '')
    return `${base}${relUrl}`
  }

  /** Upload a File/Blob and prepend it to the list (or refresh its reference count if it dedupes). */
  async function upload(file: Blob, filename?: string | null): Promise<UploadedImage> {
    const result = await uploadImageHelper(file, filename)
    const idx = images.value.findIndex((i) => i.hash === result.image.hash)
    if (idx === -1) {
      images.value.unshift({ ...result.image, reference_count: result.image.reference_count ?? 0 })
      total.value++
      // The new item shifts the server's offsets by one.
      if (nextOffset.value !== null) nextOffset.value++
    }
    return result
  }

  return { images, publicBaseUrl, loading, loadingMore, total, nextOffset, fetchImages, fetchMore, upload, absoluteUrl }
})
