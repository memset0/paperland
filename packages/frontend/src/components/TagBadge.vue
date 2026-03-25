<script setup lang="ts">
import { computed } from 'vue'
import { useTagsStore } from '@/stores/tags'

const props = defineProps<{
  tagId: number
  tagName: string
  clickable?: boolean
}>()

const emit = defineEmits<{
  click: [tagId: number]
}>()

const tagsStore = useTagsStore()

const color = computed(() => tagsStore.getTagColor(props.tagId))

const bgStyle = computed(() => {
  const c = color.value
  return {
    backgroundColor: c + '18',
    color: c,
    '--tw-ring-color': c + '30',
  }
})
</script>

<template>
  <component
    :is="clickable ? 'button' : 'span'"
    :class="[
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors',
      clickable ? 'cursor-pointer hover:opacity-80' : '',
    ]"
    :style="bgStyle"
    @click="clickable && emit('click', tagId)"
  >
    {{ tagName }}
  </component>
</template>
