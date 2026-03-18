<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePapersStore } from '@/stores/papers'

const store = usePapersStore()
const router = useRouter()
const search = ref('')
const showAddDialog = ref(false)
const addTab = ref('arxiv')
const addForm = ref({ arxiv_id: '', corpus_id: '', title: '', authors: '', content: '' })
const adding = ref(false)

const headers = [
  { title: '标题', key: 'title', sortable: false },
  { title: '作者', key: 'authors', sortable: false },
  { title: 'arXiv ID', key: 'arxiv_id', sortable: false, width: '140px' },
  { title: 'Corpus ID', key: 'corpus_id', sortable: false, width: '120px' },
  { title: '添加时间', key: 'created_at', sortable: false, width: '120px' },
]

const tableOptions = ref({ page: 1, itemsPerPage: 20 })

onMounted(() => {
  loadPapers()
})

function loadPapers() {
  store.fetchPapers(tableOptions.value.page, search.value)
}

function onUpdateOptions(opts: any) {
  tableOptions.value.page = opts.page
  tableOptions.value.itemsPerPage = opts.itemsPerPage
  loadPapers()
}

function onSearch() {
  tableOptions.value.page = 1
  loadPapers()
}

function formatAuthors(authors: string[]): string {
  if (!Array.isArray(authors) || authors.length === 0) return '-'
  if (authors.length <= 3) return authors.join(', ')
  return authors.slice(0, 3).join(', ') + ' ...'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString()
}

async function addPaper() {
  adding.value = true
  try {
    const data: any = {}
    if (addTab.value === 'arxiv') {
      data.arxiv_id = addForm.value.arxiv_id
    } else if (addTab.value === 'corpus') {
      data.corpus_id = addForm.value.corpus_id
    } else {
      data.title = addForm.value.title
      data.authors = addForm.value.authors.split(',').map((a: string) => a.trim()).filter(Boolean)
      data.content = addForm.value.content
    }
    const result = await store.createPaper(data)
    showAddDialog.value = false
    addForm.value = { arxiv_id: '', corpus_id: '', title: '', authors: '', content: '' }
    loadPapers()
    if (result.id) {
      router.push(`/papers/${result.id}`)
    }
  } finally {
    adding.value = false
  }
}
</script>

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h4">论文管理</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="showAddDialog = true">
        添加论文
      </v-btn>
    </div>

    <v-card>
      <v-card-text class="pa-4">
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          label="搜索论文 (标题、摘要)"
          variant="outlined"
          density="compact"
          hide-details
          clearable
          @keyup.enter="onSearch"
          @click:clear="search = ''; onSearch()"
          class="mb-4"
        />
      </v-card-text>

      <v-data-table-server
        :headers="headers"
        :items="store.papers"
        :items-length="store.pagination.total"
        :loading="store.loading"
        :items-per-page="tableOptions.itemsPerPage"
        :page="tableOptions.page"
        hover
        @update:options="onUpdateOptions"
        @click:row="(_: any, { item }: any) => router.push(`/papers/${item.id}`)"
        class="cursor-pointer"
      >
        <template #item.title="{ item }">
          <span class="font-weight-medium">{{ item.title }}</span>
        </template>
        <template #item.authors="{ item }">
          {{ formatAuthors(item.authors) }}
        </template>
        <template #item.arxiv_id="{ item }">
          <v-chip v-if="item.arxiv_id" size="small" color="blue" variant="tonal">{{ item.arxiv_id }}</v-chip>
          <span v-else class="text-grey">-</span>
        </template>
        <template #item.corpus_id="{ item }">
          <v-chip v-if="item.corpus_id" size="small" color="green" variant="tonal">{{ item.corpus_id }}</v-chip>
          <span v-else class="text-grey">-</span>
        </template>
        <template #item.created_at="{ item }">
          {{ formatDate(item.created_at) }}
        </template>
        <template #no-data>
          <div class="text-center pa-8 text-grey">
            <v-icon size="48" class="mb-2">mdi-file-document-outline</v-icon>
            <div>暂无论文，点击右上角添加</div>
          </div>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- Add Paper Dialog -->
    <v-dialog v-model="showAddDialog" max-width="520">
      <v-card>
        <v-card-title>添加论文</v-card-title>
        <v-card-text>
          <v-tabs v-model="addTab" class="mb-4">
            <v-tab value="arxiv">arXiv ID</v-tab>
            <v-tab value="corpus">Corpus ID</v-tab>
            <v-tab value="manual">手动输入</v-tab>
          </v-tabs>

          <v-window v-model="addTab">
            <v-window-item value="arxiv">
              <v-text-field
                v-model="addForm.arxiv_id"
                label="arXiv ID"
                placeholder="例: 1706.03762"
                variant="outlined"
                density="compact"
              />
            </v-window-item>
            <v-window-item value="corpus">
              <v-text-field
                v-model="addForm.corpus_id"
                label="Corpus ID"
                placeholder="例: 123456789"
                variant="outlined"
                density="compact"
              />
            </v-window-item>
            <v-window-item value="manual">
              <v-text-field
                v-model="addForm.title"
                label="标题"
                variant="outlined"
                density="compact"
                class="mb-2"
              />
              <v-text-field
                v-model="addForm.authors"
                label="作者 (逗号分隔)"
                variant="outlined"
                density="compact"
                class="mb-2"
              />
              <v-textarea
                v-model="addForm.content"
                label="内容"
                variant="outlined"
                density="compact"
                rows="4"
              />
            </v-window-item>
          </v-window>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showAddDialog = false">取消</v-btn>
          <v-btn color="primary" :loading="adding" @click="addPaper">添加</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.cursor-pointer :deep(tbody tr) {
  cursor: pointer;
}
</style>
