import { imagesApi } from '@/api/client'
import type { ImageWithUrl } from '@paperland/shared'

/** Read a File/Blob into a `data:` URL (base64) the upload API accepts. */
export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export interface UploadedImage {
  image: ImageWithUrl
  /** The image's public URL, relative (host-agnostic) — what goes into note Markdown. */
  url: string
  /** A ready-to-insert Markdown image link. */
  markdown: string
}

/**
 * Upload a File/Blob (e.g. from a file picker or a clipboard paste) to the image host.
 * Returns the stored image plus a relative URL and a Markdown snippet. Upload errors
 * surface through the shared API client (toast + throw).
 */
export async function uploadImage(file: Blob, filename?: string | null): Promise<UploadedImage> {
  const dataUrl = await fileToDataUrl(file)
  const name = filename ?? (file instanceof File ? file.name : null)
  const { data } = await imagesApi.upload(dataUrl, name)
  const alt = data.original_name ?? ''
  return { image: data, url: data.url, markdown: `![${alt}](${data.url})` }
}

/** Extract the first image File from a ClipboardEvent, or null if none. */
export function imageFromClipboard(e: ClipboardEvent): File | null {
  const items = e.clipboardData?.items
  if (!items) return null
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) return file
    }
  }
  return null
}
