<script setup lang="ts">
import { computed, type StyleValue } from 'vue'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{
  tagId: number
  tagName: string
  clickable?: boolean
  /** When set, render a tinted chip in this color instead of the neutral secondary badge. */
  color?: string
}>()

const emit = defineEmits<{
  click: [tagId: number]
}>()

// Tinted chip: the tag's own color as text + a translucent background/border of the same
// color. Stays readable in both light and dark themes without per-color luminance math.
// Without `color`, fall back to the neutral `secondary` badge used elsewhere in the app.
const colorStyle = computed<StyleValue | undefined>(() =>
  props.color
    ? { backgroundColor: `${props.color}1a`, borderColor: `${props.color}59`, color: props.color }
    : undefined,
)
</script>

<template>
  <Badge
    :as="clickable ? 'button' : 'span'"
    :variant="color ? 'outline' : 'secondary'"
    :style="colorStyle"
    :class="clickable ? 'cursor-pointer hover:opacity-80' : ''"
    @click="clickable && emit('click', tagId)"
  >
    {{ tagName }}
  </Badge>
</template>
