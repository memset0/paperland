<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { QAResult } from '@paperland/shared'
import { MessageSquarePlus, X, PanelRightClose } from '@lucide/vue'
import { useQAStore } from '@/stores/qa'
import { useQAConversation, type ConversationTab } from '@/composables/useQAConversation'
import { useQAComposer } from '@/composables/useQAComposer'
import QAThreadView from './QAThreadView.vue'
import QAInput from './QAInput.vue'
import { Button } from '@/components/ui/button'

// The conversation view column: thread tabs on top, the active thread as chat messages, and the
// one global question box docked at the bottom (it continues the active thread's last answer).
const props = defineProps<{ paperId: number }>()
const store = useQAStore()
const conversation = useQAConversation()
const composer = useQAComposer()

/** Tab label: the tail question (live store when loaded), else its QA id. */
function tabTitle(tab: ConversationTab): string {
  if (tab.entry_id === null) return '新对话'
  const free = store.qaData.free.find((entry) => entry.entry_id === tab.entry_id)
  if (free?.prompt) return free.prompt
  for (const [name, entry] of Object.entries(store.qaData.template)) {
    if (entry.entry_id === tab.entry_id) return store.templates.find((t) => t.name === name)?.prompt ?? name
  }
  return tailTitles.value[tab.entry_id] ?? `QA-${tab.entry_id}`
}

type Tail = { entry_id: number; result_id: number; title: string; model_name: string; status: QAResult['status'] }
const tail = ref<Tail | null>(null)
/** Titles learned from resolved threads, for tabs whose entry is outside the loaded scope. */
const tailTitles = ref<Record<number, string>>({})

function onTail(info: Tail | null) {
  tail.value = info
  if (info) tailTitles.value[info.entry_id] = info.title
}

watch(() => conversation.activeTab.value, (tab) => { if (!tab || tab.entry_id === null) tail.value = null })

/** Asking is blocked until the active thread's last answer is done. */
const blocked = computed(() => {
  const tab = conversation.activeTab.value
  if (!tab || tab.entry_id === null) return null
  if (!tail.value || tail.value.result_id !== tab.result_id) return '正在加载对话…'
  if (tail.value.status === 'done') return null
  if (['failed', 'cancelled'].includes(tail.value.status)) return '最后一个回答未成功完成，无法在此对话中追问'
  return '最后一个回答完成后才能继续追问'
})

// The docked box follows the active tab: a follow-up of its last answer, or a root question.
watch(
  () => {
    const tab = conversation.activeTab.value
    return [tab?.entry_id ?? null, tab?.result_id ?? null, tail.value?.status ?? null] as const
  },
  ([entryId, resultId]) => {
    if (!conversation.visible.value) return
    if (entryId === null) { if (composer.followup.value) composer.clearFollowup(); return }
    const known = tail.value
    if (!known || known.result_id !== resultId || known.status !== 'done') return
    if (composer.followup.value?.result_id === resultId) return
    void composer.startFollowup({ result_id: known.result_id, entry_id: known.entry_id, title: known.title, model_name: known.model_name })
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex h-full min-w-0 flex-col bg-background">
    <!-- Thread tabs -->
    <div class="flex h-9 shrink-0 items-stretch border-b">
      <div class="flex min-w-0 flex-1 items-stretch overflow-x-auto">
        <div
          v-for="(tab, index) in conversation.tabs.value" :key="`${tab.entry_id}-${tab.result_id}-${index}`"
          class="group flex max-w-44 shrink-0 cursor-pointer items-center gap-1 border-r px-2.5 text-xs"
          :class="index === conversation.active.value ? 'bg-muted/60 font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/30'"
          :title="tabTitle(tab)"
          data-conv-tab
          @click="conversation.active.value = index"
        >
          <span class="truncate">{{ tabTitle(tab) }}</span>
          <button
            type="button"
            class="shrink-0 rounded opacity-60 hover:opacity-100"
            title="关闭此对话"
            @click.stop="conversation.closeTab(index)"
          ><X class="h-3 w-3" /></button>
        </div>
      </div>
      <Button variant="ghost" size="icon-sm" class="my-auto shrink-0" title="新对话" @click="conversation.newTab()">
        <MessageSquarePlus />
      </Button>
      <Button variant="ghost" size="icon-sm" class="my-auto mr-1 shrink-0" title="关闭对话视图" @click="conversation.hide()">
        <PanelRightClose />
      </Button>
    </div>

    <!-- Active thread -->
    <div class="min-h-0 flex-1">
      <QAThreadView
        v-if="conversation.activeTab.value && conversation.activeTab.value.entry_id !== null"
        :key="`${conversation.activeTab.value.entry_id}-${conversation.activeTab.value.result_id}`"
        :paper-id="props.paperId"
        :entry-id="conversation.activeTab.value.entry_id"
        :result-id="conversation.activeTab.value.result_id"
        @tail="onTail"
      />
      <div v-else class="flex h-full items-center justify-center px-6 text-center text-xs text-muted-foreground">
        在下方提问开始新对话，或在 Q&A 列表的回答上点击「在对话视图中打开」
      </div>
    </div>

    <!-- The global question box, docked -->
    <div class="h-40 shrink-0">
      <QAInput :paper-id="props.paperId" docked :blocked="blocked" />
    </div>
  </div>
</template>
