<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{
  corpusId?: string | null
  s2Url?: string | null
}>()

// Link to the paper's Semantic Scholar page: prefer the stored s2_url (built
// from the S2 paperId), otherwise construct one from corpus_id.
const href = computed(() => {
  if (!props.corpusId) return null
  return props.s2Url || `https://www.semanticscholar.org/paper/CorpusID:${props.corpusId}`
})
</script>

<template>
  <Badge
    v-if="href"
    as="a"
    :href="href"
    target="_blank"
    rel="noopener"
    class="bg-blue-600/10 text-blue-600 [a]:hover:bg-blue-600/20 dark:bg-blue-500/20 dark:text-blue-400"
    :title="`Semantic Scholar · CorpusID:${corpusId}`"
    @click.stop
  >
    S2
  </Badge>
</template>
