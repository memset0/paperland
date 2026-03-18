<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { usePapersStore } from '@/stores/papers'

const route = useRoute()
const store = usePapersStore()

onMounted(() => {
  const id = parseInt(route.params.id as string, 10)
  store.fetchPaper(id)
})
</script>

<template>
  <div class="paper-detail" v-if="store.currentPaper">
    <h1>{{ store.currentPaper.title }}</h1>
    <div class="meta">
      <span v-if="store.currentPaper.arxiv_id">arXiv: {{ store.currentPaper.arxiv_id }}</span>
      <span v-if="store.currentPaper.corpus_id">Corpus: {{ store.currentPaper.corpus_id }}</span>
      <span>添加于 {{ new Date(store.currentPaper.created_at).toLocaleDateString() }}</span>
    </div>
    <div class="authors" v-if="store.currentPaper.authors?.length">
      <strong>作者:</strong> {{ Array.isArray(store.currentPaper.authors) ? store.currentPaper.authors.join(', ') : store.currentPaper.authors }}
    </div>
    <div class="abstract" v-if="store.currentPaper.abstract">
      <h3>摘要</h3>
      <p>{{ store.currentPaper.abstract }}</p>
    </div>
  </div>
  <div v-else class="loading">加载中...</div>
</template>

<style scoped>
.paper-detail {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
}

h1 { font-size: 22px; margin-bottom: 12px; }

.meta {
  display: flex;
  gap: 16px;
  color: #666;
  font-size: 13px;
  margin-bottom: 16px;
}

.authors { margin-bottom: 16px; font-size: 14px; }

.abstract h3 { margin-bottom: 8px; }
.abstract p { line-height: 1.6; color: #444; }

.loading { text-align: center; padding: 40px; color: #999; }
</style>
