<script setup lang="ts">
import type { Component } from 'vue'
import { Button } from '@/components/ui/button'

export interface LauncherAction {
  key: string
  label: string
  icon: Component
  onSelect: () => void
}

// Ordered list of paper-detail functions. The caller (PaperDetail) supplies them in the page's
// function order (References → Notes → Ask); only "Ask" is wired up today. Shown at the top-right
// in the wide layout; in the narrow layout the same actions live in the mobile bottom bar.
defineProps<{ actions: LauncherAction[] }>()
</script>

<template>
  <div class="flex items-center gap-2 shrink-0">
    <Button
      v-for="a in actions"
      :key="a.key"
      size="sm"
      class="gap-1.5"
      @click="a.onSelect()"
    >
      <component :is="a.icon" /> {{ a.label }}
    </Button>
  </div>
</template>
