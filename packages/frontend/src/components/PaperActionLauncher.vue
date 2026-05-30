<script setup lang="ts">
import { ref, type Component } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { Button } from '@/components/ui/button'
import { Plus, X } from '@lucide/vue'

export interface LauncherAction {
  key: string
  label: string
  icon: Component
  onSelect: () => void
}

// Ordered list of paper-detail functions. The caller (PaperDetail) supplies them
// in the page's function order (引用 → 笔记 → 提问); only "提问" is wired up today.
defineProps<{ actions: LauncherAction[] }>()

const isMobile = useMediaQuery('(max-width: 768px)')
const fabOpen = ref(false)

function pick(action: LauncherAction) {
  fabOpen.value = false
  action.onSelect()
}
</script>

<template>
  <!-- Desktop: functions listed directly at the top-right (no dropdown/menu). -->
  <div v-if="!isMobile" class="flex items-center gap-2 shrink-0">
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

  <!-- Mobile: a circular FAB that expands a vertical function list. -->
  <div v-else class="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-2">
    <div v-if="fabOpen" class="flex flex-col items-end gap-2">
      <Button
        v-for="a in actions"
        :key="a.key"
        size="sm"
        class="gap-1.5 shadow-lg"
        @click="pick(a)"
      >
        <component :is="a.icon" /> {{ a.label }}
      </Button>
    </div>
    <Button
      size="icon"
      class="h-12 w-12 rounded-full shadow-lg"
      :title="fabOpen ? '收起' : '功能'"
      :aria-expanded="fabOpen"
      @click="fabOpen = !fabOpen"
    >
      <X v-if="fabOpen" />
      <Plus v-else />
    </Button>
  </div>
</template>
