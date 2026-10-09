<script setup lang="ts">
import { Highlighter } from '@lucide/vue'
import ScopeToggle from './ScopeToggle.vue'
import { useHighlightStore } from '@/stores/highlights'
import { useAuthStore } from '@/stores/auth'

// Mine / All selector for highlight overlays. All adds other users' shared highlights
// (admins: every user's) as read-only dashed underlines. Hidden for anonymous viewers.
withDefaults(defineProps<{ size?: 'md' | 'sm' }>(), { size: 'md' })
const store = useHighlightStore()
const auth = useAuthStore()
</script>

<template>
  <ScopeToggle
    v-if="auth.isAuthenticated"
    :model-value="store.scope"
    :size="size"
    title="Highlights: show only mine, or also others' shared highlights"
    @update:model-value="store.setScope"
  >
    <template #icon><Highlighter class="h-3 w-3" /></template>
  </ScopeToggle>
</template>
