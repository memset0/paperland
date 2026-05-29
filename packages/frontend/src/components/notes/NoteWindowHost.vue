<script setup lang="ts">
import { useWindowsStore } from '@/stores/windows'
import FloatingNoteWindow from './FloatingNoteWindow.vue'

// Renders every open floating note window, above the app chrome. Mounted once (App.vue).
const store = useWindowsStore()
</script>

<template>
  <FloatingNoteWindow v-for="w in store.windows" :key="w.key" :win="w" />
</template>
