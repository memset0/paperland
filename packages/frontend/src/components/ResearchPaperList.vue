<script setup lang="ts">
import { computed } from 'vue'
import type { ResearchPaperList } from '@paperland/shared'
import PaperRefList from './PaperRefList.vue'
import { sectionsForDisplay } from '@/lib/research-list'

// One Deep Research list version through the shared PaperRefList: section titles and Markdown
// descriptions, papers (metadata resolved from S2 by id), links with their citation, Markdown
// comments, unverified markers, and — when `previous` is given — per-section added / removed items.

const props = defineProps<{ list: ResearchPaperList; previous?: ResearchPaperList | null }>()

const sections = computed(() => sectionsForDisplay(props.list, props.previous))
</script>

<template>
  <PaperRefList v-if="sections.length" :sections="sections" />
  <p v-else class="text-sm text-muted-foreground">This version has no sections.</p>
</template>
