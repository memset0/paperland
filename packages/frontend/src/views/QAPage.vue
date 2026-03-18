<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { usePapersStore } from '@/stores/papers'
import { useQAStore } from '@/stores/qa'
import TemplateQA from '@/components/TemplateQA.vue'
import FreeQA from '@/components/FreeQA.vue'

const papersStore = usePapersStore()
const qaStore = useQAStore()
const selectedPaperId = ref<number | null>(null)

onMounted(async () => {
  await papersStore.fetchPapers(1, '')
  await qaStore.fetchTemplates()
})

watch(selectedPaperId, async (id) => {
  if (id) await qaStore.fetchQA(id)
})
</script>

<template>
  <div>
    <h1 class="text-h4 mb-4">Q&A</h1>
    <v-card class="mb-4">
      <v-card-text>
        <v-autocomplete v-model="selectedPaperId" :items="papersStore.papers" item-title="title" item-value="id" label="选择论文" variant="outlined" density="compact" prepend-inner-icon="mdi-file-document" clearable hide-details />
      </v-card-text>
    </v-card>
    <div v-if="selectedPaperId">
      <TemplateQA :paper-id="selectedPaperId" />
      <FreeQA :paper-id="selectedPaperId" />
    </div>
    <v-card v-else variant="outlined">
      <v-card-text class="text-center pa-12 text-grey">
        <v-icon size="64" class="mb-4">mdi-chat-question-outline</v-icon>
        <div>请先选择一篇论文</div>
      </v-card-text>
    </v-card>
  </div>
</template>
