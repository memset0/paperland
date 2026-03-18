<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQAStore } from '@/stores/qa'
import { api } from '@/api/client'

const props = defineProps<{ paperId: number }>()
const store = useQAStore()
const question = ref('')
const availableModels = ref<Array<{ name: string; type: string }>>([])

onMounted(async () => {
  try {
    const res = await api.get<{ models: { available: Array<{ name: string; type: string }> } }>('/api/config/models')
    availableModels.value = res.models.available
    if (store.selectedModels.length === 0 && availableModels.value.length > 0) {
      store.selectedModels = [availableModels.value[0].name]
    }
  } catch {
    availableModels.value = [{ name: 'gpt-4o', type: 'openai_api' }]
    if (store.selectedModels.length === 0) store.selectedModels = ['gpt-4o']
  }
})

async function submit() {
  if (!question.value.trim()) return
  await store.submitFreeQuestion(props.paperId, question.value.trim(), store.selectedModels)
  question.value = ''
  setTimeout(() => store.fetchQA(props.paperId), 2000)
  setTimeout(() => store.fetchQA(props.paperId), 5000)
  setTimeout(() => store.fetchQA(props.paperId), 10000)
}

function getLatestResult(entry: any) {
  if (!entry.results || entry.results.length === 0) return null
  return entry.results[0]
}
</script>

<template>
  <v-card variant="outlined">
    <v-card-title>
      <v-icon class="mr-2">mdi-chat-question</v-icon>
      自由提问
    </v-card-title>
    <v-card-text>
      <div v-if="store.qaData.free.length > 0" class="mb-4">
        <div v-for="entry in store.qaData.free" :key="entry.entry_id" class="mb-3">
          <div v-if="getLatestResult(entry)">
            <div class="text-subtitle-2 font-weight-medium mb-1">
              <v-icon size="small" class="mr-1">mdi-account</v-icon>
              {{ getLatestResult(entry).prompt }}
            </div>
            <v-card variant="tonal" class="pa-3">
              <p class="text-body-2 mb-2" style="white-space: pre-wrap; line-height: 1.6;">{{ getLatestResult(entry).answer }}</p>
              <div class="d-flex align-center">
                <v-chip size="x-small" color="info" variant="tonal">{{ getLatestResult(entry).model_name }}</v-chip>
                <v-chip size="x-small" variant="tonal" class="ml-1">{{ new Date(getLatestResult(entry).completed_at).toLocaleString() }}</v-chip>
                <v-spacer />
                <v-btn size="x-small" variant="text" icon="mdi-refresh" @click="store.regenerateEntry(entry.entry_id, store.selectedModels)" />
              </div>
            </v-card>
          </div>
          <div v-else class="text-grey text-center pa-2">
            <v-progress-circular indeterminate size="20" class="mr-2" />
            正在生成回答...
          </div>
        </div>
      </div>
      <v-divider v-if="store.qaData.free.length > 0" class="mb-4" />
      <div class="mb-3">
        <div class="text-caption text-grey mb-1">选择模型</div>
        <v-chip-group v-model="store.selectedModels" multiple>
          <v-chip v-for="model in availableModels" :key="model.name" :value="model.name" filter size="small">{{ model.name }}</v-chip>
        </v-chip-group>
      </div>
      <v-textarea v-model="question" label="输入问题..." variant="outlined" density="compact" rows="2" auto-grow hide-details @keydown.ctrl.enter="submit" />
      <div class="d-flex justify-end mt-2">
        <v-btn color="primary" :loading="store.submitting" :disabled="!question.trim() || store.selectedModels.length === 0" prepend-icon="mdi-send" @click="submit">发送</v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>
