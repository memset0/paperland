<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useQAStore } from '@/stores/qa'
import { useAuthStore } from '@/stores/auth'
import { MessageSquare, RefreshCw, ChevronLeft, ChevronRight } from '@lucide/vue'
import QAFeedPanel from '@/components/QAFeedPanel.vue'
import AppPage from '@/components/AppPage.vue'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const qaStore = useQAStore()
const auth = useAuthStore()
const scrollEl = ref<HTMLElement | null>(null)

onMounted(async () => {
  qaStore.fetchModels() // shared model list for the regenerate dialog — fetched once here, not per card
  await qaStore.fetchFeed(true, 1)
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

async function goToPage(page: number) {
  await qaStore.fetchFeed(true, page)
  scrollEl.value?.scrollTo({ top: 0 })
  if (qaStore.feedHasInProgress()) {
    qaStore.startFeedPolling()
  }
}

// Admin-only: switch between own entries and all users' entries, re-fetching from page 1.
async function onScopeChange(scope: 'mine' | 'all') {
  if (qaStore.feedScope === scope) return
  qaStore.feedScope = scope
  await goToPage(1)
}
</script>

<template>
  <AppPage fill>
    <template #actions>
      <!-- Admin-only: scope toggle between own Q&A and every user's Q&A (server enforces admin). -->
      <div v-if="auth.isAdmin" class="inline-flex rounded-md ring-1 ring-foreground/10 overflow-hidden mr-1">
        <Button
          variant="ghost"
          size="sm"
          class="rounded-none h-8 px-2.5 text-xs"
          :class="qaStore.feedScope === 'mine' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'"
          :disabled="qaStore.feedLoading"
          @click="onScopeChange('mine')"
        >
          My Q&A
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="rounded-none h-8 px-2.5 text-xs"
          :class="qaStore.feedScope === 'all' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'"
          :disabled="qaStore.feedLoading"
          @click="onScopeChange('all')"
        >
          All Q&A
        </Button>
      </div>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon-sm" :disabled="qaStore.feedLoading" @click="onRefresh">
            <RefreshCw :class="qaStore.feedLoading && 'animate-spin'" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>刷新</TooltipContent>
      </Tooltip>
    </template>

    <div v-if="qaStore.feedLoading" class="flex-1 overflow-y-auto px-6 pt-2 pb-6">
      <div class="space-y-3">
        <div v-for="i in qaStore.feedPagination.page_size" :key="i">
          <!-- above-card: paper title + time -->
          <div class="flex items-center gap-2 px-1 mb-1.5">
            <Skeleton class="h-3 w-1/3 rounded" />
            <Skeleton class="ml-auto h-2.5 w-14 shrink-0 rounded" />
          </div>
          <!-- card: status + question + badge -->
          <div class="rounded-lg ring-1 ring-foreground/10 bg-card px-5 py-3.5 flex items-center gap-3">
            <Skeleton class="h-4 w-4 rounded-full shrink-0" />
            <Skeleton class="h-4 flex-1 rounded" />
            <Skeleton class="h-5 w-14 rounded-full shrink-0" />
          </div>
        </div>
      </div>
    </div>

    <template v-else-if="qaStore.feedEntries.length > 0">
      <div ref="scrollEl" class="flex-1 overflow-y-auto px-6 pt-2 pb-6">
        <div class="space-y-3">
          <QAFeedPanel
            v-for="entry in qaStore.feedEntries"
            :key="entry.entry_id"
            :entry="entry"
            @refresh="onRefresh"
          />
        </div>
      </div>

      <div
        v-if="qaStore.feedPagination.total_pages > 1"
        class="shrink-0 flex items-center justify-center gap-2 py-3 border-t"
      >
        <Button
          variant="outline"
          size="icon-sm"
          :disabled="qaStore.feedPagination.page <= 1"
          @click="goToPage(qaStore.feedPagination.page - 1)"
        >
          <ChevronLeft />
        </Button>
        <span class="text-xs text-muted-foreground tabular-nums">
          {{ qaStore.feedPagination.page }} / {{ qaStore.feedPagination.total_pages }}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          :disabled="qaStore.feedPagination.page >= qaStore.feedPagination.total_pages"
          @click="goToPage(qaStore.feedPagination.page + 1)"
        >
          <ChevronRight />
        </Button>
      </div>
    </template>

    <div v-else class="flex-1 flex items-center justify-center">
      <div class="text-center text-muted-foreground">
        <MessageSquare class="h-10 w-10 mx-auto mb-3 stroke-1" />
        <p class="text-sm">暂无自由提问记录</p>
        <p class="text-xs mt-1">在论文详情页中提交自由提问</p>
      </div>
    </div>
  </AppPage>
</template>
