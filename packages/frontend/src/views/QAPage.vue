<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useQAStore } from '@/stores/qa'
import { MessageSquare, Loader2 } from '@lucide/vue'
import QAFeedPanel from '@/components/QAFeedPanel.vue'
import AppPage from '@/components/AppPage.vue'

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
  <AppPage fill>
    <div v-if="qaStore.feedLoading" class="flex-1 flex items-center justify-center">
      <div class="text-center text-muted-foreground">
        <Loader2 class="h-6 w-6 mx-auto mb-3 animate-spin text-primary" />
        <p class="text-sm">加载中...</p>
      </div>
    </div>

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

    <div v-else class="flex-1 flex items-center justify-center">
      <div class="text-center text-muted-foreground">
        <MessageSquare class="h-10 w-10 mx-auto mb-3 stroke-1" />
        <p class="text-sm">暂无自由提问记录</p>
        <p class="text-xs mt-1">在论文详情页中提交自由提问</p>
      </div>
    </div>
  </AppPage>
</template>
