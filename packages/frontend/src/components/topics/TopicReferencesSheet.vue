<script setup lang="ts">
import { ref } from 'vue'
import { ChevronRight } from '@lucide/vue'
import type { TopicDetail, TopicPaper } from '@paperland/shared'
import MarkdownContent from '@/components/MarkdownContent.vue'
import TopicReferenceList from '@/components/topics/TopicReferenceList.vue'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

defineProps<{ detail: TopicDetail; entries: TopicPaper[]; busy: string; imported: Set<string> }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ import: [entryId: string]; link: [event: MouseEvent] }>()
const notesOpen = ref(false)
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="w-full overflow-y-auto sm:max-w-xl" @click.capture="emit('link', $event)">
      <SheetHeader>
        <SheetTitle>All references <span class="ml-1 font-normal tabular-nums text-muted-foreground">{{ entries.length }}</span></SheetTitle>
        <SheetDescription>One shared catalog, numbered by when each work joined this topic.</SheetDescription>
      </SheetHeader>
      <div data-reading-surface="catalog" class="px-6 pb-6">
        <TopicReferenceList :detail="detail" :entries="entries" :busy="busy" :imported="imported" compact @import="emit('import', $event)" />
        <p v-if="!entries.length" class="py-12 text-center text-sm text-muted-foreground">References will appear here as this topic grows.</p>
        <Collapsible v-if="detail.snapshot.list.directories.some((d) => d.description)" v-model:open="notesOpen" class="mt-6 border-t pt-4">
          <CollapsibleTrigger class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"><ChevronRight :class="['size-4 transition-transform', notesOpen && 'rotate-90']" />Previous directory notes</CollapsibleTrigger>
          <CollapsibleContent>
            <section v-for="directory in detail.snapshot.list.directories.filter((d) => d.description)" :key="directory.id" class="mt-4">
              <h3 class="mb-2 text-sm font-medium">{{ directory.name }}</h3>
              <MarkdownContent :content="directory.description!" disable-highlights qa-answer />
            </section>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </SheetContent>
  </Sheet>
</template>
