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
      <Collapsible v-if="node.children.length" :open="openFolders[node.key] ?? false" @update:open="$emit('toggle', node.key, $event)">
        <div :class="['flex min-w-0 items-center rounded-md transition-colors', selected === node.document?.path ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground']">
          <CollapsibleTrigger :aria-label="`${openFolders[node.key] ? 'Collapse' : 'Expand'} ${node.name}`" class="flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-muted"><ChevronRight :class="['size-3.5 transition-transform', openFolders[node.key] ? 'rotate-90' : '']" /></CollapsibleTrigger>
          <button v-if="node.document" :title="node.name" :aria-current="selected === node.document.path ? 'page' : undefined" class="flex min-w-0 flex-1 items-start gap-2 rounded-md py-1.5 pr-2 text-left text-sm font-medium" @click="$emit('select', node.document.path)">
            <component :is="topicIcon(node.document.fonticon || 'FileText')" class="mt-0.5 size-4 shrink-0" /><span class="min-w-0 break-words leading-5">{{ node.name }}</span>
          </button>
          <CollapsibleTrigger v-else class="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm font-medium leading-5"><component :is="node.fonticon ? topicIcon(node.fonticon) : Folder" class="size-4 shrink-0" /><span class="min-w-0 break-words">{{ node.name }}</span></CollapsibleTrigger>
        </div>
        <CollapsibleContent><TopicFileBranch class="ml-3 border-l pl-1.5" :nodes="node.children" :selected="selected" :home="home" :open-folders="openFolders" @select="$emit('select', $event)" @toggle="(path, open) => $emit('toggle', path, open)" /></CollapsibleContent>
      </Collapsible>
      <button v-else-if="node.document" :title="node.name" :aria-current="selected === node.document.path ? 'page' : undefined" :class="['flex w-full min-w-0 items-start gap-2 rounded-md px-2 py-2 text-left text-sm lg:py-1.5 transition-colors', selected === node.document.path ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground']" @click="$emit('select', node.document.path)">
        <component :is="topicIcon(node.document.fonticon || (node.document.path === home ? 'BookOpen' : 'FileText'))" class="mt-0.5 size-4 shrink-0" /><span class="min-w-0 break-words leading-5">{{ node.name }}</span>
      </button>
    </template>
  </div>
</template>
