<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <ol data-slot="breadcrumb-list" :class="cn('text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs/relaxed break-words', props.class)">
    <slot />
  </ol>
</template>
