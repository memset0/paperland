<script setup lang="ts">
// Home → Features: every announced feature, newest first. Unseen ones carry a red dot and the
// header shows how many are new; opening (clicking) a card marks it seen. Nothing is pushed.
import { onMounted } from 'vue'
import { Sparkles } from '@lucide/vue'
import { Card } from '@/components/ui/card'
import FeatureCard from '@/components/FeatureCard.vue'
import { useFeaturesStore } from '@/stores/features'

const store = useFeaturesStore()

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
    </div>
    <div v-if="store.features.length" class="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
      <FeatureCard v-for="f in store.features" :key="f.key" :feature="f" @open="store.markSeen([$event])" />
    </div>
    <div v-else-if="store.loaded" class="py-10 text-center text-sm text-muted-foreground">No features yet</div>
  </Card>
</template>
