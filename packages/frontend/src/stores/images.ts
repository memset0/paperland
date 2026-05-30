import { defineStore } from 'pinia'
import { ref } from 'vue'
import { imagesApi } from '@/api/client'
import { uploadImage as uploadImageHelper, type UploadedImage } from '@/utils/uploadImage'
import type { ImageWithUrl } from '@paperland/shared'

export const useImagesStore = defineStore('images', () => {
  const images = ref<ImageWithUrl[]>([])
  const publicBaseUrl = ref('')
  const loading = ref(false)

  async function fetchImages() {
    loading.value = true
    try {
      const res = await imagesApi.list()
      images.value = res.data
      publicBaseUrl.value = res.public_base_url || ''
    } finally {
      loading.value = false
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
    if (idx === -1) images.value.unshift({ ...result.image, reference_count: result.image.reference_count ?? 0 })
    return result
  }

  async function deleteImage(hash: string) {
    await imagesApi.remove(hash)
    images.value = images.value.filter((i) => i.hash !== hash)
  }

  return { images, publicBaseUrl, loading, fetchImages, upload, deleteImage, absoluteUrl }
})
