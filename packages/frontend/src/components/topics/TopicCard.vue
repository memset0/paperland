<script setup lang="ts">
import type { TopicSummary } from '@paperland/shared'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { relativeTime } from '@/lib/relative-time'

defineProps<{ topic: TopicSummary }>()
</script>

<template>
  <RouterLink :to="`/topics/${topic.id}`" class="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <Card class="h-full gap-3 py-5 transition-colors group-hover:bg-accent/40 group-hover:ring-foreground/20">
      <CardHeader class="px-5">
        <CardTitle class="text-base leading-snug font-semibold tracking-tight break-words">{{ topic.title }}</CardTitle>
        <CardDescription v-if="topic.description" class="line-clamp-2 text-sm leading-relaxed">{{ topic.description }}</CardDescription>
      </CardHeader>
      <CardFooter class="mt-auto flex items-center gap-2 px-5 text-xs text-muted-foreground">
        <span class="truncate">{{ topic.owner_display_name }}</span>
        <span aria-hidden="true">·</span>
        <time :datetime="topic.updated_at" :title="new Date(topic.updated_at).toLocaleString()" class="shrink-0">Updated {{ relativeTime(topic.updated_at) }}</time>
        <Badge v-if="topic.archived_at" variant="outline" class="ml-auto shrink-0">Archived</Badge>
        <Badge v-else-if="topic.permission !== 'owner'" variant="secondary" class="ml-auto shrink-0 capitalize">{{ topic.permission }}</Badge>
      </CardFooter>
    </Card>
  </RouterLink>
</template>
