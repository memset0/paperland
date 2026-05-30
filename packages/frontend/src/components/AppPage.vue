<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useRoute } from 'vue-router'

/**
 * Shared layout for "management" pages. Owns the page title (fixed position,
 * consistent size, plain text — no icon, no description) and the content width.
 *
 * - `title`  in-page title; defaults to the route's `meta.title` (English, matches
 *            the sidebar label and the browser tab).
 * - `icon`   icon shown to the left of the title; defaults to the route's
 *            `meta.icon` (the same icon the sidebar uses for this page).
 * - `full`   full-bleed width when true; centered `max-w-5xl` when false (default).
 * - `fill`   full-height layout for pages that manage their own internal scroll
 *            (e.g. Q&A): the title header stays fixed and the content fills the
 *            remaining height. When false (default) the page flows normally and
 *            scrolls with the app's <main> outlet.
 *
 * Detail pages (paper detail, idea workspace) do NOT use this component.
 */
const props = defineProps<{
  title?: string
  icon?: Component
  full?: boolean
  fill?: boolean
}>()

const route = useRoute()
const pageTitle = computed(() => props.title ?? (route.meta.title as string | undefined) ?? '')
const pageIcon = computed(() => props.icon ?? (route.meta.icon as Component | undefined))
const widthClass = computed(() => (props.full ? '' : 'mx-auto w-full max-w-5xl'))
</script>

<template>
  <!-- fill mode: full-height column; header fixed, content fills remaining height -->
  <div v-if="fill" class="h-full flex flex-col overflow-hidden">
    <div :class="['shrink-0 px-6 pt-6 pb-4', widthClass]">
      <div class="flex items-center justify-between gap-3">
        <h1 class="flex items-center gap-2 text-xl font-semibold">
          <component :is="pageIcon" v-if="pageIcon" class="h-5 w-5 shrink-0 text-primary" />
          {{ pageTitle }}
        </h1>
        <div v-if="$slots.actions" class="flex items-center gap-2">
          <slot name="actions" />
        </div>
      </div>
    </div>
    <div :class="['flex-1 min-h-0 flex flex-col overflow-hidden', widthClass]">
      <slot />
    </div>
  </div>

  <!-- normal mode: flows and scrolls with the app's <main> outlet -->
  <div v-else :class="['px-6 py-6', widthClass]">
    <header class="flex items-center justify-between gap-3 mb-4 sm:mb-6">
      <h1 class="flex items-center gap-2 text-xl font-semibold">
        <component :is="pageIcon" v-if="pageIcon" class="h-5 w-5 shrink-0 text-primary" />
        {{ pageTitle }}
      </h1>
      <div v-if="$slots.actions" class="flex items-center gap-2">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </div>
</template>
