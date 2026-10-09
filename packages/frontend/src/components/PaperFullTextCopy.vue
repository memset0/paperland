<script setup lang="ts">
import { computed } from 'vue'
import { Copy } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { api } from '@/api/client'
import { useDoc2xStore } from '@/stores/doc2x'
import { usePapersStore } from '@/stores/papers'
import type { Paper } from '@paperland/shared'

const props = defineProps<{ paperId: number }>()

const doc2x = useDoc2xStore()
const papers = usePapersStore()

type Source = 'pdf_parsed' | 'doc2x_parsed'
const sources: Array<{ key: Source; label: string }> = [
  { key: 'pdf_parsed', label: '复制全文（直接解析）' },
  { key: 'doc2x_parsed', label: '复制全文（doc2x）' },
]

function cachedText(key: Source): string | null {
  const paper = papers.currentPaper
  return paper?.id === props.paperId ? paper.contents?.[key] ?? null : null
}

// Enabled once the version exists: either already in the loaded paper or reported by the
// (polled) doc2x status, so a parse finishing while the page is open enables its button.
const available = computed<Record<Source, boolean>>(() => ({
  pdf_parsed: !!cachedText('pdf_parsed') || !!doc2x.status?.text_sources.pdf_parsed,
  doc2x_parsed: !!cachedText('doc2x_parsed') || !!doc2x.status?.text_sources.doc2x_parsed,
}))

async function copy(key: Source) {
  let text = cachedText(key)
  if (!text) {
    // Finished after the page loaded — fetch the fresh contents.
    const fresh = await api.get<Paper>(`/api/papers/${props.paperId}`)
    text = fresh.contents?.[key] ?? null
  }
  if (!text) { toast.error('全文尚未就绪'); return }
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`已复制全文（${text.length.toLocaleString()} 字符）`)
  } catch {
    toast.error('复制失败，请检查浏览器剪贴板权限')
  }
}
</script>

<template>
  <div class="space-y-2">
    <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">全文</div>
    <div class="flex flex-wrap gap-1.5">
      <Button
        v-for="s in sources" :key="s.key"
        variant="outline" size="sm"
        :disabled="!available[s.key]"
        :title="available[s.key] ? undefined : '解析完成后可用'"
        @click="copy(s.key)"
      >
        <Copy />{{ s.label }}
      </Button>
    </div>
  </div>
</template>
