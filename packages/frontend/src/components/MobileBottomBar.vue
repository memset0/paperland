<script setup lang="ts">
// Bottom app bar for complex pages in their single-column layout (paper detail, Deep Research
// detail). Section items switch the page's visible area (v-model); action items emit `action`.
// The page decides when to render it (narrow layout, not embed); it slides in on appearance and
// sets `--bottom-bar-h` on the document so the page can reserve space for it.
import { onBeforeUnmount, onMounted, type Component } from 'vue'
import { Loader2 } from '@lucide/vue'

export interface BottomBarItem {
  key: string
  label: string
  icon: Component
  /** `section` switches the visible area (default); `action` triggers something. */
  kind?: 'section' | 'action'
  /** Small count shown on the icon (hidden when 0 / absent). */
  badge?: number
  /** Show a spinner instead of the icon (e.g. a round is running). */
  busy?: boolean
}

defineProps<{ items: BottomBarItem[] }>()
const active = defineModel<string>({ required: true })
const emit = defineEmits<{ action: [key: string] }>()

function select(item: BottomBarItem) {
  if (item.kind === 'action') emit('action', item.key)
  else active.value = item.key
}

// 56px bar + the device's bottom safe area; pages pad with `var(--bottom-bar-h)`.
const BAR_HEIGHT = 'calc(56px + env(safe-area-inset-bottom, 0px))'
onMounted(() => document.documentElement.style.setProperty('--bottom-bar-h', BAR_HEIGHT))
onBeforeUnmount(() => document.documentElement.style.removeProperty('--bottom-bar-h'))
</script>

<template>
  <Transition
    appear
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="translate-y-full opacity-0"
    leave-active-class="transition duration-200 ease-in"
    leave-to-class="translate-y-full opacity-0"
  >
    <nav
      class="fixed bottom-0 left-0 right-0 z-40 border-t md:left-[52px] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style="padding-bottom: env(safe-area-inset-bottom, 0px)"
      aria-label="Page sections"
      data-mobile-bottom-bar
    >
      <div class="mx-auto flex h-14 max-w-xl items-stretch">
        <button
          v-for="item in items" :key="item.key"
          type="button"
          class="relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors"
          :class="item.kind !== 'action' && active === item.key ? 'text-primary' : 'text-muted-foreground hover:text-foreground'"
          :aria-current="item.kind !== 'action' && active === item.key ? 'page' : undefined"
          :data-bottom-bar-item="item.key"
          @click="select(item)"
        >
          <span
            v-if="item.kind !== 'action' && active === item.key"
            class="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary"
          />
          <span class="relative">
            <Loader2 v-if="item.busy" class="size-5 animate-spin" />
            <component :is="item.icon" v-else class="size-5" />
            <span
              v-if="item.badge"
              class="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 text-primary-foreground"
            >{{ item.badge }}</span>
          </span>
          <span>{{ item.label }}</span>
        </button>
      </div>
    </nav>
  </Transition>
</template>
