<script setup lang="ts">
import { computed } from 'vue'
import { useQAStore } from '@/stores/qa'

const props = defineProps<{ paperId: number }>()
const store = useQAStore()

const hasUngenerated = computed(() => {
  return store.templates.some((t) => {
    const entry = store.qaData.template[t.name]
    return !entry || entry.results.length === 0
  })
})

function getLatestResult(templateName: string) {
  const entry = store.qaData.template[templateName]
  if (!entry || entry.results.length === 0) return null
  return entry.results[0]
}

function getStatus(templateName: string): 'done' | 'idle' {
  return getLatestResult(templateName) ? 'done' : 'idle'
}

let pollTimer: ReturnType<typeof setInterval> | null = null

async function generateAll() {
  await store.triggerAllTemplates(props.paperId)
  startPolling()
}

async function regenerate(templateName: string) {
  await store.regenerateTemplate(props.paperId, templateName)
  startPolling()
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    await store.fetchQA(props.paperId)
    const allDone = store.templates.every((t) => {
      const entry = store.qaData.template[t.name]
      return entry && entry.results.length > 0
    })
    if (allDone && pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }, 3000)
}
</script>

<template>
  <v-card variant="outlined" class="mb-4">
    <v-card-title class="d-flex align-center">
      <v-icon class="mr-2">mdi-file-document-check</v-icon>
      模板提问
      <v-spacer />
      <v-btn v-if="hasUngenerated" color="primary" size="small" prepend-icon="mdi-play-circle" :loading="store.submitting" @click="generateAll">
        一键生成所有
      </v-btn>
    </v-card-title>
    <v-card-text>
      <div v-if="store.templates.length === 0" class="text-grey text-center pa-4">
        暂无模板（在 templates/ 目录中添加 .md 文件）
      </div>
      <v-expansion-panels v-else variant="accordion">
        <v-expansion-panel v-for="tmpl in store.templates" :key="tmpl.name">
          <v-expansion-panel-title>
            <div class="d-flex align-center" style="width: 100%">
              <v-icon :color="getStatus(tmpl.name) === 'done' ? 'success' : 'grey'" size="small" class="mr-2">
                {{ getStatus(tmpl.name) === 'done' ? 'mdi-check-circle' : 'mdi-circle-outline' }}
              </v-icon>
              <span class="font-weight-medium text-capitalize">{{ tmpl.name }}</span>
              <v-spacer />
              <v-chip v-if="getLatestResult(tmpl.name)" size="x-small" color="info" variant="tonal" class="mr-2">
                {{ getLatestResult(tmpl.name)!.model_name }}
              </v-chip>
            </div>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <div v-if="getLatestResult(tmpl.name)">
              <p class="text-body-2" style="white-space: pre-wrap; line-height: 1.7;">{{ getLatestResult(tmpl.name)!.answer }}</p>
              <div class="d-flex align-center mt-3">
                <v-chip size="x-small" variant="tonal">{{ new Date(getLatestResult(tmpl.name)!.completed_at).toLocaleString() }}</v-chip>
                <v-spacer />
                <v-btn size="small" variant="tonal" prepend-icon="mdi-refresh" @click="regenerate(tmpl.name)">重新生成</v-btn>
              </div>
            </div>
            <div v-else class="text-grey text-center pa-4">
              未生成
              <v-btn size="small" variant="tonal" class="ml-2" @click="regenerate(tmpl.name)">生成</v-btn>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card-text>
  </v-card>
</template>
