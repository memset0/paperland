<script setup lang="ts">
import { computed } from 'vue'
import { FileText, Quote } from '@lucide/vue'
import type { TopicSummary } from '@paperland/shared'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { relativeTime } from '@/lib/relative-time'

const props = defineProps<{ topic: TopicSummary }>()

/** Two-letter monogram from the first two words of the title. */
const monogram = computed(() => {
  const words = props.topic.title.split(/[\s\-_/:]+/).filter((w) => /[\p{L}\p{N}]/u.test(w))
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase()
})
/** Stable hue per Topic; the tile colors in both themes come from it (see the scoped CSS). */
const hue = computed(() => (props.topic.id * 47) % 360)
const owner = computed(() => props.topic.owner_display_name)
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
</script>

<template>
  <RouterLink :to="`/topics/${topic.id}`" class="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <Card
      class="h-full gap-0 py-0 transition-all duration-200 group-hover:-translate-y-px group-hover:shadow-md group-hover:ring-foreground/20"
      :class="topic.archived_at && 'opacity-80'"
    >
      <div class="flex flex-1 flex-col gap-3 p-5">
        <div class="flex items-start gap-3">
          <span class="flex size-10 bg-[oklch(0.93_0.05_var(--tile-h))] text-[oklch(0.38_0.1_var(--tile-h))] dark:bg-[oklch(0.32_0.06_var(--tile-h))] dark:text-[oklch(0.88_0.06_var(--tile-h))] shrink-0 items-center justify-center rounded-lg text-sm font-semibold tracking-wide" :style="{ '--tile-h': hue }" aria-hidden="true">{{ monogram }}</span>
          <h2 class="min-w-0 flex-1 pt-0.5 text-base font-semibold leading-snug tracking-tight break-words group-hover:text-primary">{{ topic.title }}</h2>
          <Badge v-if="topic.archived_at" variant="outline" class="shrink-0">Archived</Badge>
          <Badge v-else-if="topic.permission !== 'owner'" variant="secondary" class="shrink-0 capitalize">{{ topic.permission }}</Badge>
        </div>
        <p class="line-clamp-2 min-h-[2lh] text-sm leading-relaxed" :class="topic.description ? 'text-muted-foreground' : 'text-muted-foreground/60 italic'">
          {{ topic.description || 'No description' }}
        </p>
      </div>
      <Separator />
      <div class="flex items-center gap-3 px-5 py-3 text-xs whitespace-nowrap text-muted-foreground sm:gap-4">
        <span class="inline-flex items-center gap-1.5" :title="plural(topic.page_count, 'page')"><FileText class="size-3.5" />{{ plural(topic.page_count, 'page') }}</span>
        <span class="inline-flex items-center gap-1.5" :title="plural(topic.reference_count, 'reference')"><Quote class="size-3.5" />{{ plural(topic.reference_count, 'reference') }}</span>
        <span class="ml-auto inline-flex min-w-0 items-center gap-1.5">
          <span :title="owner" class="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold uppercase text-foreground/80" aria-hidden="true">{{ owner.slice(0, 1) }}</span>
          <span class="hidden truncate sm:inline">{{ owner }}</span>
          <span class="hidden sm:inline" aria-hidden="true">·</span>
          <time :datetime="topic.updated_at" :title="`Updated ${new Date(topic.updated_at).toLocaleString()}`" class="shrink-0">{{ relativeTime(topic.updated_at) }}</time>
        </span>
      </div>
    </Card>
  </RouterLink>
</template>

