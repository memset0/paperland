<script setup lang="ts">
import type { TopicDefaultAccess } from '@paperland/shared'
import { Globe, LockKeyhole } from '@lucide/vue'

const props = defineProps<{ modelValue: TopicDefaultAccess; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: TopicDefaultAccess] }>()
</script>

<template>
  <fieldset :disabled="disabled" class="space-y-3">
    <legend class="mb-2 text-sm font-medium">General access</legend>
    <div class="flex flex-wrap items-center gap-2">
      <LockKeyhole v-if="props.modelValue === 'none'" class="size-4 shrink-0 text-muted-foreground" /><Globe v-else class="size-4 shrink-0 text-primary" />
      <select aria-label="Topic visibility" :value="modelValue === 'none' ? 'private' : 'public'" class="h-9 rounded-md border bg-background px-3 text-sm" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value === 'private' ? 'none' : 'viewer')">
        <option value="private">Private</option><option value="public">Public</option>
      </select>
      <select v-if="modelValue !== 'none'" aria-label="Default permission for other users" :value="modelValue" class="h-9 rounded-md border bg-background px-3 text-sm" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value as TopicDefaultAccess)">
        <option value="viewer">Viewer</option><option value="editor">Editor</option>
      </select>
    </div>
    <p class="text-xs leading-relaxed text-muted-foreground">{{ modelValue === 'none' ? 'Only you and people you add can access this topic.' : modelValue === 'viewer' ? 'Other signed-in Paperland users can read this topic.' : 'Other signed-in Paperland users can read and edit this topic.' }}</p>
  </fieldset>
</template>
