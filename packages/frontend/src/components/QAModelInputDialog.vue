<script setup lang="ts">
import { ref, watch } from 'vue'
import type { QAModelInputView } from '@paperland/shared'
import { Loader2 } from '@lucide/vue'
import { useQAStore } from '@/stores/qa'
import { inputPageLabel } from '@/composables/useQAComposer'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const props = defineProps<{ resultId: number }>()
const open = defineModel<boolean>('open', { default: false })
const store = useQAStore()
const view = ref<QAModelInputView | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

// Fetched only when opened: the backend rebuilds the input with the current rules each time.
watch(open, async (isOpen) => {
  if (!isOpen) return
  loading.value = true
  error.value = null
  try {
    view.value = await store.fetchModelInput(props.resultId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Model input</DialogTitle>
        <DialogDescription>按当前配置重建，可能与当时实际发送的内容不同。</DialogDescription>
      </DialogHeader>

      <div v-if="loading" class="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 class="h-4 w-4 animate-spin" /> Loading…
      </div>
      <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>
      <div v-else-if="view" class="space-y-3 text-xs">
        <details>
          <summary class="cursor-pointer font-semibold">System · {{ view.system_prompt_name }}</summary>
          <pre class="mt-1 whitespace-pre-wrap rounded-md bg-muted p-2 font-mono">{{ view.system_prompt }}</pre>
        </details>
        <section>
          <div class="font-semibold">&lt;paper&gt;</div>
          <p class="mt-1 text-muted-foreground">{{ view.paper.source }} · {{ view.paper.length.toLocaleString() }} 字符（全文不展开）</p>
        </section>
        <details v-if="view.references">
          <summary class="cursor-pointer font-semibold">&lt;references&gt;</summary>
          <pre class="mt-1 whitespace-pre-wrap rounded-md bg-muted p-2 font-mono">{{ view.references }}</pre>
        </details>
        <section v-if="view.inputs.length">
          <div class="font-semibold">&lt;inputs&gt;</div>
          <div class="mt-1 space-y-1.5">
            <div v-for="input in view.inputs" :key="input.label" class="rounded-md bg-muted p-2">
              <span class="font-medium">@{{ input.label }}</span>
              <span v-if="inputPageLabel(input)" class="ml-1 text-muted-foreground">{{ inputPageLabel(input) }}</span>
              <img v-if="input.kind === 'image'" :src="input.url" alt="" class="mt-1 max-h-40 rounded" />
              <p v-else class="mt-1 whitespace-pre-wrap">{{ input.text }}</p>
            </div>
          </div>
        </section>
        <details v-if="view.history" open>
          <summary class="cursor-pointer font-semibold">&lt;history&gt;</summary>
          <pre class="mt-1 whitespace-pre-wrap rounded-md bg-muted p-2 font-mono">{{ view.history }}</pre>
        </details>
        <section>
          <div class="font-semibold">&lt;question&gt;</div>
          <pre class="mt-1 whitespace-pre-wrap rounded-md bg-muted p-2 font-mono">{{ view.question }}</pre>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>
