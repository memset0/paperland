<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useQAStore } from '@/stores/qa'
import { MessageSquare, Loader2 } from 'lucide-vue-next'
import QAFeedPanel from '@/components/QAFeedPanel.vue'

const qaStore = useQAStore()

onMounted(async () => {
  await qaStore.fetchFeed(true)
  if (qaStore.feedHasInProgress()) {
    qaStore.startFeedPolling()
  }
})

onUnmounted(() => {
  qaStore.stopFeedPolling()
})

async function onRefresh() {
  await qaStore.fetchFeed()
  if (qaStore.feedHasInProgress()) {
    qaStore.startFeedPolling()
  }
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div class="p-6 pb-0">
      <div class="mb-6">
        <h1 class="text-xl font-semibold text-gray-900">Q&A</h1>
        <p class="text-sm text-gray-500 mt-0.5">所有自由提问，按时间排列</p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="qaStore.feedLoading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <Loader2 class="h-6 w-6 mx-auto mb-3 animate-spin text-indigo-500" />
        <p class="text-sm text-gray-400">加载中...</p>
      </div>
    </div>

    <!-- Feed list -->
    <div v-else-if="qaStore.feedEntries.length > 0" class="flex-1 overflow-y-auto px-6 pb-6">
      <div class="space-y-3">
        <QAFeedPanel
          v-for="entry in qaStore.feedEntries"
          :key="entry.entry_id"
          :entry="entry"
          @refresh="onRefresh"
        />
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <MessageSquare class="h-10 w-10 mx-auto mb-3 text-gray-300 stroke-1" />
        <p class="text-sm text-gray-400">暂无自由提问记录</p>
        <p class="text-xs text-gray-300 mt-1">在论文详情页中提交自由提问</p>
      </div>
    </div>
  </div>
</template>
