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

type Source = 'user_input' | 'pdf_parsed' | 'doc2x_parsed'
const PDF_SOURCES: Array<{ key: Source; label: string }> = [
  { key: 'pdf_parsed', label: 'Copy full text (basic parse)' },
  { key: 'doc2x_parsed', label: 'Copy full text (doc2x)' },
]
// Blog posts: copy the article's Markdown; PDF copies only when the article also has a parsed PDF.
const isArticle = computed(() => papers.currentPaper?.id === props.paperId && papers.currentPaper?.kind === 'article')
const sources = computed(() => isArticle.value
  ? [{ key: 'user_input' as Source, label: 'Copy full text' }, ...PDF_SOURCES.filter((s) => available.value[s.key])]
  : PDF_SOURCES)

function cachedText(key: Source): string | null {
  const paper = papers.currentPaper
  return paper?.id === props.paperId ? paper.contents?.[key] ?? null : null
}

// Enabled once the version exists: either already in the loaded paper or reported by the
// (polled) doc2x status, so a parse finishing while the page is open enables its button.
const available = computed<Record<Source, boolean>>(() => ({
  user_input: !!cachedText('user_input'),
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
  if (!text) { toast.error("Full text isn't ready"); return }
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`Copied full text (${text.length.toLocaleString()} characters)`)
  } catch {
    toast.error('Copy failed. Check clipboard permissions.')
  }
}
</script>

<template>
  <div class="space-y-2">
    <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full text</div>
    <div class="flex flex-wrap gap-1.5">
      <Button
        v-for="s in sources" :key="s.key"
        variant="outline" size="sm"
        :disabled="!available[s.key]"
        :title="available[s.key] ? undefined : 'Available after parsing'"
        @click="copy(s.key)"
      >
        <Copy />{{ s.label }}
      </Button>
    </div>
  </div>
</template>
