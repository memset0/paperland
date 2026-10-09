<script setup lang="ts">
import { Highlighter } from '@lucide/vue'
import { useHighlightStore } from '@/stores/highlights'
import { useAuthStore } from '@/stores/auth'

// Mine / All selector for highlight overlays. All adds other users' shared highlights
// (admins: every user's) as read-only dashed underlines. Hidden for anonymous viewers.
const store = useHighlightStore()
const auth = useAuthStore()
</script>

<template>
  <div
    v-if="auth.isAuthenticated"
    class="inline-flex items-center rounded border overflow-hidden text-xs shrink-0"
    title="Highlights: show only mine, or also others' shared highlights"
  >
    <span class="px-1.5 text-muted-foreground"><Highlighter class="h-3 w-3" /></span>
    <button
      class="px-2 py-0.5"
      :class="store.scope === 'mine' ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'"
      @click="store.setScope('mine')"
    >Mine</button>
    <button
      class="px-2 py-0.5"
      :class="store.scope === 'all' ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'"
      @click="store.setScope('all')"
    >All</button>
  </div>
</template>
