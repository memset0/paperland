<script setup lang="ts">
import { computed } from 'vue'
import type { TopicDefaultAccess } from '@paperland/shared'
import { Globe, LockKeyhole } from '@lucide/vue'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const props = defineProps<{ modelValue: TopicDefaultAccess; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: TopicDefaultAccess] }>()
const visibility = computed({
  get: () => props.modelValue === 'none' ? 'private' : 'public',
  set: (value: string) => emit('update:modelValue', value === 'private' ? 'none' : props.modelValue === 'none' ? 'viewer' : props.modelValue),
})
const role = computed({ get: () => props.modelValue, set: (value: string) => emit('update:modelValue', value as TopicDefaultAccess) })
</script>

<template>
  <div class="space-y-2">
    <Label>General access</Label>
    <div class="flex flex-wrap items-center gap-2">
      <Select v-model="visibility" :disabled="disabled">
        <SelectTrigger aria-label="Topic visibility" class="w-36">
          <LockKeyhole v-if="modelValue === 'none'" class="text-muted-foreground" /><Globe v-else class="text-primary" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="private">Private</SelectItem>
          <SelectItem value="public">Public</SelectItem>
        </SelectContent>
      </Select>
      <Select v-if="modelValue !== 'none'" v-model="role" :disabled="disabled">
        <SelectTrigger aria-label="Default permission for other users" class="w-28"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="viewer">Viewer</SelectItem>
          <SelectItem value="editor">Editor</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <p class="text-xs leading-relaxed text-muted-foreground">{{ modelValue === 'none' ? 'Only you and people you add can access this topic.' : modelValue === 'viewer' ? 'Other signed-in Paperland users can read this topic.' : 'Other signed-in Paperland users can read and edit this topic.' }}</p>
  </div>
</template>
