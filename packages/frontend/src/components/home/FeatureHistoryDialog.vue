<script setup lang="ts">
// Home → Features → "All features": the full feature history, newest first. Unseen cards keep their
// red dot and can be clicked to mark them seen; opening the dialog marks nothing.
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import FeatureCard from '@/components/FeatureCard.vue'
import { useFeaturesStore } from '@/stores/features'

const open = defineModel<boolean>('open', { default: false })
const store = useFeaturesStore()
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>All features</DialogTitle>
        <DialogDescription>Every feature announced in Paperland, newest first.</DialogDescription>
      </DialogHeader>
      <div v-if="store.features.length" class="grid gap-3 sm:grid-cols-2">
        <FeatureCard v-for="f in store.features" :key="f.key" :feature="f" @open="store.markSeen([$event])" />
      </div>
      <div v-else class="py-10 text-center text-sm text-muted-foreground">No features yet</div>
    </DialogContent>
  </Dialog>
</template>
