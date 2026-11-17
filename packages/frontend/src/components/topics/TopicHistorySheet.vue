<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check, Loader2 } from '@lucide/vue'
import { topicsApi, type TopicHistory } from '@/api/topics'
import { relativeTime } from '@/lib/relative-time'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const props = defineProps<{ topicId: number; current: string; selectedCommit: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ view: [commit?: string] }>()
const history = ref<TopicHistory>({ versions: [], total: 0, next_offset: null }), busy = ref(false)

async function load(more = false) {
  const topicId = props.topicId, offset = more ? history.value.next_offset : 0
  if (offset == null || busy.value) return
  busy.value = true
  try {
    const result = (await topicsApi.history(topicId, offset)).data
    if (props.topicId === topicId) history.value = { ...result, versions: more ? [...history.value.versions, ...result.versions] : result.versions }
  } catch {} finally { busy.value = false }
}
watch(open, (value) => { if (value) void load() })
watch(() => props.topicId, () => { history.value = { versions: [], total: 0, next_offset: null } })
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="w-full overflow-y-auto sm:max-w-md">
      <SheetHeader>
        <SheetTitle>Version history</SheetTitle>
        <SheetDescription>Read earlier versions of the reports and references. The pusher and the Git author are recorded separately.</SheetDescription>
      </SheetHeader>
      <div class="px-6 pb-6">
        <ol class="relative space-y-1 border-l pl-4">
          <li v-for="(version, index) in history.versions" :key="version.commit">
            <span :class="['absolute -left-[5px] mt-3 size-2.5 rounded-full border-2 border-background', (selectedCommit ? selectedCommit === version.commit : index === 0) ? 'bg-primary' : 'bg-muted-foreground/40']" />
            <button type="button" class="w-full rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted" @click="emit('view', index === 0 ? undefined : version.commit)">
              <span class="flex items-start justify-between gap-2">
                <span class="line-clamp-2 text-sm font-medium">{{ version.message || 'Update topic' }}</span>
                <Badge v-if="index === 0" variant="secondary" class="shrink-0">Latest</Badge>
                <Check v-else-if="selectedCommit === version.commit" class="mt-0.5 size-3.5 shrink-0 text-primary" />
              </span>
              <span class="mt-1 block text-xs text-muted-foreground">
                {{ version.pushed_by_display_name }}<template v-if="version.pushed_via"> via {{ version.pushed_via }}</template>
                · <time :datetime="version.pushed_at" :title="new Date(version.pushed_at).toLocaleString()">{{ relativeTime(version.pushed_at) }}</time>
              </span>
              <span class="mt-0.5 block font-mono text-[11px] text-muted-foreground" :title="`Git author: ${version.author_name} <${version.author_email}>`">{{ version.commit.slice(0, 7) }} · {{ version.author_name }}</span>
            </button>
          </li>
        </ol>
        <p v-if="!busy && !history.versions.length" class="py-10 text-center text-sm text-muted-foreground">No versions yet.</p>
        <div class="mt-4 flex justify-center">
          <Loader2 v-if="busy" class="size-4 animate-spin text-muted-foreground" />
          <Button v-else-if="history.next_offset !== null" variant="outline" @click="load(true)">Load older versions</Button>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
