<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Bot } from '@lucide/vue'
import type { TopicDocument } from '@paperland/shared'
import { topicDocumentTree } from '@/lib/topic-navigation'
import TopicFileBranch from '@/components/TopicFileBranch.vue'

const props = defineProps<{ documents: TopicDocument[]; selected: string; home: string }>()
defineEmits<{ select: [path: string] }>()
const tree = computed(() => topicDocumentTree(props.documents, props.home))
const openFolders = ref<Record<string, boolean>>({})
watch(() => props.selected, (path) => {
  const parts = path.split('/'); parts.pop()
  for (let length = 2; length <= parts.length; length++) openFolders.value[parts.slice(0, length).join('/')] = true
}, { immediate: true })
</script>

<template>
  <nav aria-label="Topic pages" class="space-y-0.5">
    <p class="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pages</p>
    <TopicFileBranch :nodes="tree" :selected="selected" :home="home" :open-folders="openFolders" @select="$emit('select', $event)" @toggle="(path, open) => openFolders[path] = open" />
    <template v-if="documents.some((d) => d.path === 'AGENTS.md')"><div class="my-3 border-t lg:my-2" /><button :aria-current="selected === 'AGENTS.md' ? 'page' : undefined" :class="['flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm leading-5 lg:py-1.5', selected === 'AGENTS.md' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground']" @click="$emit('select', 'AGENTS.md')"><Bot class="size-4" />Agent guide</button></template>
  </nav>
</template>
