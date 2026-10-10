<script setup lang="ts">
// Home → Features: only the features the user has not opened yet, newest first, each with a red dot.
// Clicking a card marks it seen and it leaves the list; "All features" opens the full history.
// Nothing is pushed.
import { computed, onMounted, ref } from 'vue'
import { Sparkles } from '@lucide/vue'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import FeatureCard from '@/components/FeatureCard.vue'
import FeatureHistoryDialog from './FeatureHistoryDialog.vue'
import { useFeaturesStore } from '@/stores/features'

const store = useFeaturesStore()
const unseen = computed(() => store.features.filter((f) => !f.seen))
const historyOpen = ref(false)

// App.vue loads the list per signed-in account; this only covers a cold start.
onMounted(() => store.load())
</script>

<template>
  <Card class="gap-0 overflow-hidden py-0">
    <div class="flex items-center gap-2 border-b px-5 py-3">
      <Sparkles class="h-4 w-4 text-muted-foreground" />
      <h3 class="text-sm font-semibold">Features</h3>
      <span
        v-if="store.newCount > 0"
        class="min-w-4 h-4 rounded-full bg-destructive px-1 text-center text-[10px] leading-4 text-white"
        :title="`${store.newCount} new ${store.newCount === 1 ? 'feature' : 'features'}`"
      >{{ store.newCount }}</span>
      <Button size="xs" variant="ghost" class="ml-auto" @click="historyOpen = true">All features</Button>
    </div>
    <TransitionGroup
      v-if="unseen.length"
      tag="div"
      class="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3"
      leave-active-class="transition-all duration-200"
      leave-to-class="opacity-0 scale-95"
    >
      <FeatureCard v-for="f in unseen" :key="f.key" :feature="f" @open="store.markSeen([$event])" />
    </TransitionGroup>
    <div v-else-if="store.loaded" class="py-10 text-center text-sm text-muted-foreground">No new features</div>
    <FeatureHistoryDialog v-model:open="historyOpen" />
  </Card>
</template>
