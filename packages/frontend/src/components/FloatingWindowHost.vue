<script setup lang="ts">
import { useWindowsStore } from '@/stores/windows'
import FloatingWindow from './FloatingWindow.vue'
import NoteEditor from './notes/NoteEditor.vue'
import QATreeView from './QATreeView.vue'

// Renders the app's titled floating windows (note editors, Q&A tree) above the app chrome, all
// through the shared FloatingWindow shell. Mounted once (App.vue). The question box (`qa-ask`)
// uses the same store and shell but is rendered by QAInput itself.
const store = useWindowsStore()
</script>

<template>
  <template v-for="w in store.windows" :key="w.key">
    <FloatingWindow v-if="w.kind === 'section' || w.kind === 'doc'" :win="w">
      <NoteEditor :win="w" />
    </FloatingWindow>
    <FloatingWindow v-else-if="w.kind === 'qa-tree'" :win="w" :min-width="360" :min-height="240">
      <div class="h-full overflow-auto">
        <QATreeView :paper-id="w.paperId" />
      </div>
    </FloatingWindow>
  </template>
</template>
