<script lang="ts">
/** View-model for a Q&A mind-map node. Follow-ups hang under their parent question. */
export interface QATreeItem {
  id: string
  entryId: number | null
  label: string
  status: string
  isCenter: boolean
  isTemplate: boolean
  answerCount: number
  children: QATreeItem[]
}
</script>

<script setup lang="ts">
import { CheckCircle2, Loader2, AlertCircle, Circle } from '@lucide/vue'

// One node of the Q&A tree view (same nested-flex layout as the note mind map; connectors are
// drawn by the parent QATreeView from DOM positions).
defineOptions({ name: 'QATreeNode' })
const props = defineProps<{ node: QATreeItem }>()
const emit = defineEmits<{ select: [entryId: number] }>()

function onClick() {
  if (props.node.entryId != null) emit('select', props.node.entryId)
}
</script>

<template>
  <div class="qt-node">
    <div
      :data-nid="node.id"
      class="qt-box"
      :class="{ 'qt-center': node.isCenter }"
      :title="node.isCenter ? node.label : `${node.label}\nQA-${node.entryId} · 点击在对话视图中打开`"
      @click="onClick"
    >
      <template v-if="!node.isCenter">
        <Loader2 v-if="node.status === 'running' || node.status === 'pending'" class="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
        <AlertCircle v-else-if="node.status === 'failed'" class="h-3.5 w-3.5 shrink-0 text-destructive" />
        <CheckCircle2 v-else-if="node.status === 'done'" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <Circle v-else class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </template>
      <span class="qt-title" :class="{ 'line-clamp-2': !node.isCenter }">{{ node.label }}</span>
      <span v-if="node.isTemplate" class="qt-meta">Preset</span>
      <span v-if="!node.isCenter" class="qt-meta">QA-{{ node.entryId }}</span>
    </div>
    <div v-if="node.children.length" class="qt-kids">
      <QATreeNode v-for="child in node.children" :key="child.id" :node="child" @select="emit('select', $event)" />
    </div>
  </div>
</template>

<style scoped>
.qt-node { display: flex; align-items: center; }
.qt-box {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; max-width: 320px;
  border: 1px solid var(--border); border-radius: 8px;
  background: var(--card); cursor: pointer; font-size: 13px;
}
.qt-box:hover { border-color: var(--ring); }
.qt-center { border-color: var(--primary); font-weight: 600; cursor: default; max-width: 240px; }
.qt-center:hover { border-color: var(--primary); }
.qt-title { overflow-wrap: anywhere; }
.qt-meta { flex-shrink: 0; color: var(--muted-foreground); font-size: 10px; }
.qt-kids { display: flex; flex-direction: column; gap: 10px; margin-left: 34px; }
</style>
