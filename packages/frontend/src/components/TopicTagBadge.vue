<script setup lang="ts">
import type { TopicTag } from '@paperland/shared'
import { useRouter } from 'vue-router'
import { Telescope } from '@lucide/vue'
defineProps<{ tag: TopicTag }>()
const router = useRouter()
</script>

<template>
  <button type="button" class="inline-flex max-w-full items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[11px] text-primary hover:bg-primary/10" :title="`Filter papers in ${tag.name}`" @click.stop="router.push({ path: '/papers', query: { scope: 'all', topic_id: String(tag.topic_id) } })">
    <Telescope class="size-3 shrink-0" /><span class="truncate">{{ tag.name }}</span>
  </button>
</template>
