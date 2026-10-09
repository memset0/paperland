<script setup lang="ts">
// The one Mine / All scope selector used by every list that has a personal vs everyone view
// (papers, notes, Q&A feed, User Q&A, reference links, highlights). `size="md"` for page
// toolbars, `size="sm"` inside a section header. Labels are always "Mine" / "All".
export type Scope = 'mine' | 'all'

withDefaults(defineProps<{
  modelValue: Scope
  size?: 'md' | 'sm'
  disabled?: boolean
  title?: string
}>(), { size: 'md', disabled: false })

const emit = defineEmits<{ 'update:modelValue': [value: Scope] }>()
const OPTIONS: Array<{ value: Scope; label: string }> = [
  { value: 'mine', label: 'Mine' },
  { value: 'all', label: 'All' },
]
</script>

<template>
  <!-- Segmented control: a muted track with an inset pill that slides to the selected option. -->
  <div
    class="inline-flex items-center shrink-0 rounded-lg bg-muted p-0.5 normal-case tracking-normal font-normal"
    :class="size === 'md' ? 'h-8 text-xs' : 'h-6 text-[11px]'"
    :title="title"
  >
    <span v-if="$slots.icon" class="flex items-center h-full text-muted-foreground" :class="size === 'md' ? 'px-2' : 'px-1.5'">
      <slot name="icon" />
    </span>
    <div class="relative grid grid-cols-2 h-full">
      <span
        aria-hidden="true"
        class="absolute inset-y-0 left-0 w-1/2 rounded-md bg-background shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none"
        :class="modelValue === 'all' ? 'translate-x-full' : 'translate-x-0'"
      />
      <button
        v-for="o in OPTIONS" :key="o.value"
        type="button"
        class="relative h-full rounded-md transition-colors duration-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :class="[
          size === 'md' ? 'px-3' : 'px-2',
          modelValue === o.value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        ]"
        :disabled="disabled"
        :aria-pressed="modelValue === o.value"
        @click="modelValue !== o.value && emit('update:modelValue', o.value)"
      >{{ o.label }}</button>
    </div>
  </div>
</template>
