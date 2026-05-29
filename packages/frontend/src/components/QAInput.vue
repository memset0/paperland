<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQAStore } from '@/stores/qa'
import { useAuthStore } from '@/stores/auth'
import { useLoginPrompt } from '@/composables/useLoginPrompt'
import { api } from '@/api/client'
import { Send, LogIn } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'

const props = withDefaults(defineProps<{ paperId: number; sticky?: boolean }>(), { sticky: true })
const store = useQAStore()
const auth = useAuthStore()
const { openLogin } = useLoginPrompt()
const question = ref('')
const availableModels = ref<Array<{ name: string }>>([])

onMounted(async () => {
  if (!auth.isAuthenticated) return // models endpoint requires login; anon sees a login prompt
  try {
    const res = await api.get<{ models: { available: Array<{ name: string }> } }>('/api/config/models')
    availableModels.value = res.models.available
  } catch {
    availableModels.value = [{ name: 'gpt-4o' }]
  }
  const names = availableModels.value.map(m => m.name)
  const valid = store.selectedModels.filter(m => names.includes(m))
  if (valid.length) {
    store.selectedModels = valid
  } else if (names.length) {
    store.selectedModels = [names[0]]
  }
})

async function submit() {
  if (!auth.isAuthenticated) { openLogin(); return }
  if (!question.value.trim() || !store.selectedModels.length) return
  await store.submitFreeQuestion(props.paperId, question.value.trim(), store.selectedModels)
  question.value = ''
}

function toggleModel(name: string) {
  if (store.selectedModels.includes(name)) {
    store.selectedModels = store.selectedModels.filter(x => x !== name)
  } else {
    store.selectedModels.push(name)
  }
}
</script>

<template>
  <div :class="[sticky ? 'fixed bottom-0 left-0 right-0 md:sticky md:left-auto md:right-auto' : '', 'z-10 px-3 md:px-5 pt-3 md:pt-4 pb-3 md:pb-4']">
    <Card class="px-3 md:px-4 shadow-lg md:shadow-2xl">
      <template v-if="auth.isAuthenticated">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-[10px] text-muted-foreground uppercase tracking-wider mr-0.5">模型</span>
          <Button
            v-for="m in availableModels" :key="m.name"
            :variant="store.selectedModels.includes(m.name) ? 'secondary' : 'outline'"
            size="xs"
            @click="toggleModel(m.name)"
          >
            {{ m.name }}
          </Button>
        </div>
        <div class="flex gap-2 items-end">
          <Textarea
            v-model="question"
            @keydown.ctrl.enter="submit"
            placeholder="输入问题..."
            rows="2"
            class="max-h-32 flex-1"
          />
          <Button
            @click="submit"
            :disabled="!question.trim() || !store.selectedModels.length || store.submitting"
            size="icon"
          >
            <Send />
          </Button>
        </div>
      </template>
      <button
        v-else
        type="button"
        class="flex w-full items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground"
        @click="openLogin()"
      >
        <LogIn class="h-4 w-4" /> 登录后可对论文提问
      </button>
    </Card>
  </div>
</template>
