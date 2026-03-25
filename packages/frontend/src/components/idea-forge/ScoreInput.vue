<script setup lang="ts">
const props = defineProps<{
  modelValue: number
  readonly?: boolean
  size?: 'sm' | 'md'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function setScore(n: number) {
  if (props.readonly) return
  emit('update:modelValue', n === props.modelValue ? 0 : n)
}
</script>

<template>
  <div class="flex items-center gap-0.5" :class="readonly ? 'opacity-70' : ''">
    <button
      v-for="n in 5" :key="n"
      @click="setScore(n)"
      :disabled="readonly"
      :class="[
        'transition-colors',
        size === 'sm' ? 'text-sm' : 'text-base',
        readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110',
        n <= modelValue ? 'text-amber-400' : 'text-gray-300',
      ]"
      :title="readonly ? undefined : (n === modelValue ? 'Clear score' : `Score ${n}`)"
    >
      ★
    </button>
  </div>
</template>
