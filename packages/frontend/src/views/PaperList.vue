<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePapersStore } from '@/stores/papers'

const store = usePapersStore()
const router = useRouter()
const search = ref('')
const showAddDialog = ref(false)
const addMode = ref<'arxiv' | 'corpus' | 'manual'>('arxiv')
const addForm = ref({ arxiv_id: '', corpus_id: '', title: '', authors: '', content: '' })

onMounted(() => {
  store.fetchPapers()
})

function onSearch() {
  store.fetchPapers(1, search.value)
}

function goToPage(page: number) {
  store.fetchPapers(page, search.value)
}

async function addPaper() {
  const data: any = {}
  if (addMode.value === 'arxiv') {
    data.arxiv_id = addForm.value.arxiv_id
  } else if (addMode.value === 'corpus') {
    data.corpus_id = addForm.value.corpus_id
  } else {
    data.title = addForm.value.title
    data.authors = addForm.value.authors.split(',').map((a: string) => a.trim()).filter(Boolean)
    data.content = addForm.value.content
  }

  const result = await store.createPaper(data)
  showAddDialog.value = false
  addForm.value = { arxiv_id: '', corpus_id: '', title: '', authors: '', content: '' }
  store.fetchPapers()
  if (result.id) {
    router.push(`/papers/${result.id}`)
  }
}
</script>

<template>
  <div class="paper-list">
    <div class="header">
      <h1>论文管理</h1>
      <button class="btn primary" @click="showAddDialog = true">添加论文</button>
    </div>

    <div class="search-bar">
      <input v-model="search" placeholder="搜索论文 (标题、摘要)..." @keyup.enter="onSearch" />
      <button class="btn" @click="onSearch">搜索</button>
    </div>

    <div v-if="store.loading" class="loading">加载中...</div>

    <div v-else class="paper-table">
      <table>
        <thead>
          <tr>
            <th>标题</th>
            <th>作者</th>
            <th>arXiv ID</th>
            <th>Corpus ID</th>
            <th>添加时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="paper in store.papers" :key="paper.id" @click="router.push(`/papers/${paper.id}`)" class="clickable">
            <td class="title-cell">{{ paper.title }}</td>
            <td>{{ Array.isArray(paper.authors) ? paper.authors.slice(0, 3).join(', ') : '' }}{{ Array.isArray(paper.authors) && paper.authors.length > 3 ? '...' : '' }}</td>
            <td>{{ paper.arxiv_id || '-' }}</td>
            <td>{{ paper.corpus_id || '-' }}</td>
            <td>{{ new Date(paper.created_at).toLocaleDateString() }}</td>
          </tr>
          <tr v-if="store.papers.length === 0">
            <td colspan="5" class="empty">暂无论文</td>
          </tr>
        </tbody>
      </table>

      <div class="pagination" v-if="store.pagination.total_pages > 1">
        <button :disabled="store.pagination.page <= 1" @click="goToPage(store.pagination.page - 1)">上一页</button>
        <span>{{ store.pagination.page }} / {{ store.pagination.total_pages }}</span>
        <button :disabled="store.pagination.page >= store.pagination.total_pages" @click="goToPage(store.pagination.page + 1)">下一页</button>
      </div>
    </div>

    <!-- Add Paper Dialog -->
    <div v-if="showAddDialog" class="dialog-overlay" @click.self="showAddDialog = false">
      <div class="dialog">
        <h2>添加论文</h2>
        <div class="tabs">
          <button :class="{ active: addMode === 'arxiv' }" @click="addMode = 'arxiv'">arXiv ID</button>
          <button :class="{ active: addMode === 'corpus' }" @click="addMode = 'corpus'">Corpus ID</button>
          <button :class="{ active: addMode === 'manual' }" @click="addMode = 'manual'">手动输入</button>
        </div>

        <div v-if="addMode === 'arxiv'" class="form-group">
          <label>arXiv ID</label>
          <input v-model="addForm.arxiv_id" placeholder="例: 1706.03762" />
        </div>

        <div v-if="addMode === 'corpus'" class="form-group">
          <label>Corpus ID</label>
          <input v-model="addForm.corpus_id" placeholder="例: 123456789" />
        </div>

        <div v-if="addMode === 'manual'">
          <div class="form-group">
            <label>标题</label>
            <input v-model="addForm.title" placeholder="论文标题" />
          </div>
          <div class="form-group">
            <label>作者 (逗号分隔)</label>
            <input v-model="addForm.authors" placeholder="作者1, 作者2" />
          </div>
          <div class="form-group">
            <label>内容</label>
            <textarea v-model="addForm.content" placeholder="论文内容..." rows="5"></textarea>
          </div>
        </div>

        <div class="dialog-actions">
          <button class="btn" @click="showAddDialog = false">取消</button>
          <button class="btn primary" @click="addPaper">添加</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

h1 { font-size: 24px; }

.search-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.search-bar input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
}

.btn.primary {
  background: #1a73e8;
  color: #fff;
  border-color: #1a73e8;
}

.btn:hover { opacity: 0.9; }

table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}

th, td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

th { background: #fafafa; font-weight: 600; font-size: 13px; color: #666; }

tr.clickable { cursor: pointer; }
tr.clickable:hover { background: #f8f9fa; }

.title-cell { font-weight: 500; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.empty { text-align: center; color: #999; padding: 40px; }

.loading { text-align: center; padding: 40px; color: #999; }

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
}

.pagination button {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}

.pagination button:disabled { opacity: 0.5; cursor: not-allowed; }

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 480px;
  max-height: 80vh;
  overflow-y: auto;
}

.dialog h2 { margin-bottom: 16px; }

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
}

.tabs button {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}

.tabs button.active {
  background: #1a73e8;
  color: #fff;
  border-color: #1a73e8;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  color: #666;
}

.form-group input, .form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>
