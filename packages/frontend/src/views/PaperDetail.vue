<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePapersStore } from '@/stores/papers'
import { useQAStore } from '@/stores/qa'
import TemplateQA from '@/components/TemplateQA.vue'
import FreeQA from '@/components/FreeQA.vue'

const route = useRoute()
const router = useRouter()
const store = usePapersStore()
const qaStore = useQAStore()

const paperId = computed(() => parseInt(route.params.id as string, 10))

onMounted(async () => {
  await store.fetchPaper(paperId.value)
  await qaStore.fetchTemplates()
  await qaStore.fetchQA(paperId.value)
})
</script>

<template>
  <div>
    <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-4" @click="router.push('/')">
      返回列表
    </v-btn>

    <v-skeleton-loader v-if="store.loading" type="article" />

    <template v-else-if="store.currentPaper">
      <v-card class="mb-4">
        <v-card-title class="text-h5 pa-6 pb-2">
          {{ store.currentPaper.title }}
        </v-card-title>

        <v-card-text class="pa-6 pt-2">
          <div class="d-flex flex-wrap ga-2 mb-4">
            <v-chip v-if="store.currentPaper.arxiv_id" color="blue" variant="tonal" prepend-icon="mdi-link-variant">
              arXiv: {{ store.currentPaper.arxiv_id }}
            </v-chip>
            <v-chip v-if="store.currentPaper.corpus_id" color="green" variant="tonal" prepend-icon="mdi-link-variant">
              Corpus: {{ store.currentPaper.corpus_id }}
            </v-chip>
            <v-chip variant="tonal" prepend-icon="mdi-calendar">
              {{ new Date(store.currentPaper.created_at).toLocaleDateString() }}
            </v-chip>
          </div>

          <div v-if="store.currentPaper.authors?.length" class="mb-4">
            <div class="text-subtitle-2 text-grey mb-1">作者</div>
            <v-chip v-for="author in (Array.isArray(store.currentPaper.authors) ? store.currentPaper.authors : [])" :key="author" size="small" class="mr-1 mb-1">
              {{ author }}
            </v-chip>
          </div>

          <div v-if="(store.currentPaper as any).tags?.length" class="mb-4">
            <div class="text-subtitle-2 text-grey mb-1">标签</div>
            <v-chip v-for="tag in (store.currentPaper as any).tags" :key="tag" size="small" color="purple" variant="tonal" class="mr-1">{{ tag }}</v-chip>
          </div>

          <v-divider class="my-4" />

          <div v-if="store.currentPaper.abstract">
            <div class="text-subtitle-1 font-weight-bold mb-2">摘要</div>
            <p class="text-body-1" style="line-height: 1.7;">{{ store.currentPaper.abstract }}</p>
          </div>

          <div v-if="store.currentPaper.pdf_path" class="mt-4">
            <v-chip color="orange" variant="tonal" prepend-icon="mdi-file-pdf-box">
              PDF: {{ store.currentPaper.pdf_path }}
            </v-chip>
          </div>
        </v-card-text>
      </v-card>

      <!-- Q&A Section -->
      <TemplateQA :paper-id="paperId" />
      <FreeQA :paper-id="paperId" />
    </template>

    <v-alert v-else type="warning" class="mt-4">论文未找到</v-alert>
  </div>
</template>
