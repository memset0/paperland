<script setup lang="ts">
import { Badge } from '@/components/ui/badge'

defineProps<{
  tagId: number
  tagName: string
  clickable?: boolean
}>()

const emit = defineEmits<{
  click: [tagId: number]
}>()
</script>

<template>
  <Badge
    :as="clickable ? 'button' : 'span'"
    variant="secondary"
    :class="clickable ? 'cursor-pointer hover:opacity-80' : ''"
    @click="clickable && emit('click', tagId)"
  >
    {{ tagName }}
  </Badge>
</template>
