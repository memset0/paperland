<script setup lang="ts">
import { ChevronRight, Folder } from '@lucide/vue'
import { topicIcon } from '@/lib/topic-icons'
import type { TopicTreeNode } from '@/lib/topic-navigation'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

defineProps<{ nodes: TopicTreeNode[]; selected: string; home: string; openFolders: Record<string, boolean> }>()
defineEmits<{ select: [path: string]; toggle: [path: string, open: boolean] }>()
</script>

<template>
  <div class="space-y-0.5">
    <template v-for="node in nodes" :key="node.key">
      <button v-if="node.document" :title="node.document.path" :aria-current="selected === node.document.path ? 'page' : undefined" :class="['flex w-full min-w-0 items-start gap-2 rounded-lg px-2 py-2 text-left text-sm lg:py-1.5 transition-colors', selected === node.document.path ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground']" @click="$emit('select', node.document.path)">
        <component :is="topicIcon(node.document.fonticon || (node.document.path === home ? 'BookOpen' : 'FileText'))" class="mt-0.5 size-4 shrink-0" /><span class="min-w-0 break-words leading-5">{{ node.name }}</span>
      </button>
      <Collapsible v-else :open="openFolders[node.key] ?? false" @update:open="$emit('toggle', node.key, $event)">
        <CollapsibleTrigger class="flex w-full min-w-0 items-center gap-1.5 rounded-lg px-2 py-2 text-left text-sm font-medium leading-5 lg:py-1 text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronRight :class="['size-3 shrink-0 transition-transform', openFolders[node.key] ? 'rotate-90' : '']" /><Folder class="size-3.5 shrink-0" /><span class="min-w-0 break-words">{{ node.name }}</span></CollapsibleTrigger>
        <CollapsibleContent><TopicFileBranch class="ml-2 border-l pl-1" :nodes="node.children" :selected="selected" :home="home" :open-folders="openFolders" @select="$emit('select', $event)" @toggle="(path, open) => $emit('toggle', path, open)" /></CollapsibleContent>
      </Collapsible>
    </template>
  </div>
</template>
