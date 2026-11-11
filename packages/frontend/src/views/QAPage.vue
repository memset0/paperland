<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useQAStore } from '@/stores/qa'
import { MessageSquare, RefreshCw, ChevronLeft, ChevronRight, ArrowUpRight } from '@lucide/vue'
import QAFeedPanel from '@/components/QAFeedPanel.vue'
import AppPage from '@/components/AppPage.vue'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import HighlightScopeToggle from '@/components/HighlightScopeToggle.vue'
import ScopeToggle from '@/components/ScopeToggle.vue'

const qaStore = useQAStore()
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

// Every authenticated viewer can switch between own and all users' entries.
async function onScopeChange(scope: 'mine' | 'all') {
  if (qaStore.feedScope === scope) return
  qaStore.feedScope = scope
  await goToPage(1)
}
</script>

<template>
  <AppPage fill class="bg-muted/20">
    <template #actions>
      <div class="flex items-center gap-2" role="group" aria-label="Question scope">
        <span class="text-[11px] text-muted-foreground max-[360px]:sr-only">Questions</span>
        <ScopeToggle
          :model-value="qaStore.feedScope"
          :disabled="qaStore.feedLoading"
          title="Q&A: only mine, or everyone's shared Q&A"
          @update:model-value="onScopeChange"
        />
      </div>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon-sm" aria-label="Refresh questions" :disabled="qaStore.feedLoading" @click="onRefresh">
            <RefreshCw :class="qaStore.feedLoading && 'animate-spin'" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Refresh</TooltipContent>
      </Tooltip>
    </template>

    <div class="mx-6 mb-5 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b pb-4">
      <p class="text-xs text-muted-foreground" aria-live="polite" aria-atomic="true">
        <template v-if="qaStore.feedLoading">Loading questions…</template>
        <template v-else><span class="font-medium text-foreground tabular-nums">{{ qaStore.feedPagination.total.toLocaleString('en-US') }}</span> {{ qaStore.feedPagination.total === 1 ? 'question' : 'questions' }}</template>
      </p>
      <div class="flex items-center gap-2" role="group" aria-label="Highlight scope">
        <span class="text-[11px] text-muted-foreground">Highlights</span>
        <HighlightScopeToggle size="sm" />
      </div>
    </div>

    <div v-if="qaStore.feedLoading" class="flex-1 overflow-y-auto px-6 pb-6" role="status" aria-label="Loading questions">
      <div class="space-y-6" aria-hidden="true">
        <div v-for="i in 6" :key="i">
          <!-- above-card: paper title + time -->
          <div class="flex items-center gap-2 px-1 mb-2.5">
            <Skeleton class="h-3 w-2/3 rounded" />
            <Skeleton class="ml-auto h-3 w-10 shrink-0 rounded" />
          </div>
          <!-- card: status + question + badge -->
          <div class="rounded-xl ring-1 ring-border bg-card p-5 space-y-4">
            <div class="flex items-start gap-3">
              <Skeleton class="h-6 w-6 rounded-md shrink-0" />
              <div class="flex-1 space-y-2">
                <Skeleton class="h-4 w-full rounded" />
                <Skeleton class="h-4 w-2/3 rounded" />
              </div>
            </div>
            <Skeleton class="h-5 w-36 rounded-md sm:ml-9" />
          </div>
        </div>
      </div>
    </div>

    <template v-else-if="qaStore.feedEntries.length > 0">
      <div ref="scrollEl" class="flex-1 overflow-y-auto px-6 pb-8 [scrollbar-gutter:stable]">
        <div class="space-y-6">
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
        class="mx-6 shrink-0 flex items-center justify-between gap-3 border-t py-3"
        aria-label="Question pagination"
      >
        <Button
          variant="outline"
          size="sm"
          aria-label="Previous page"
          :disabled="qaStore.feedPagination.page <= 1"
          @click="goToPage(qaStore.feedPagination.page - 1)"
        >
          <ChevronLeft /><span class="hidden sm:inline">Previous</span>
        </Button>
        <span class="text-xs text-muted-foreground tabular-nums">
          Page {{ qaStore.feedPagination.page }} of {{ qaStore.feedPagination.total_pages }}
        </span>
        <Button
          variant="outline"
          size="sm"
          aria-label="Next page"
          :disabled="qaStore.feedPagination.page >= qaStore.feedPagination.total_pages"
          @click="goToPage(qaStore.feedPagination.page + 1)"
        >
          <span class="hidden sm:inline">Next</span><ChevronRight />
        </Button>
      </div>
    </template>

    <div v-else class="flex-1 flex items-center justify-center overflow-y-auto px-6 pb-8">
      <div class="max-w-sm rounded-2xl border border-dashed bg-card/60 px-6 py-10 text-center">
        <div class="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessageSquare class="h-6 w-6 stroke-[1.5]" />
        </div>
        <h2 class="text-base font-semibold">Your next insight starts with a question</h2>
        <p class="mt-2 text-sm leading-6 text-muted-foreground">Open a paper and ask a free question. Your questions and answers will appear here.</p>
        <Button as-child variant="outline" class="mt-6">
          <router-link to="/papers">Browse papers<ArrowUpRight /></router-link>
        </Button>
      </div>
    </div>
  </AppPage>
</template>
