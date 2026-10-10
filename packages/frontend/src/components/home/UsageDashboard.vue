<script setup lang="ts">
// Home usage dashboard: one time-window switch driving both the leaderboard podium and the
// signed-in user's own usage.
import { ref, onMounted } from 'vue'
import { Trophy } from '@lucide/vue'
import type { MyUsage, UsageLeaderboardEntry } from '@paperland/shared'
import { usageApi } from '@/api/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import UsagePodium from './UsagePodium.vue'
import UsageSummary from './UsageSummary.vue'
import { USAGE_WINDOWS } from './usage-format'

const days = ref<number | undefined>(undefined)
const mine = ref<MyUsage | null>(null)
const board = ref<UsageLeaderboardEntry[]>([])

async function load() {
  const window = days.value
  const [me, lb] = await Promise.allSettled([usageApi.me(window), usageApi.leaderboard(window)])
  if (window !== days.value) return // a newer switch is in flight
  mine.value = me.status === 'fulfilled' ? me.value.data : null
  board.value = lb.status === 'fulfilled' ? lb.value.data : []
}

function pick(value: number | undefined) {
  days.value = value
  load()
}

onMounted(load)
</script>

<template>
  <Card class="overflow-hidden gap-0 py-0">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
      <div class="flex items-center gap-2">
        <Trophy class="h-4 w-4 text-muted-foreground" />
        <h3 class="text-sm font-semibold">Usage</h3>
      </div>
      <div class="flex gap-1">
        <Button v-for="w in USAGE_WINDOWS" :key="w.label" size="xs" :variant="days === w.days ? 'secondary' : 'ghost'" @click="pick(w.days)">{{ w.label }}</Button>
      </div>
    </div>
    <UsagePodium :entries="board" />
    <UsageSummary :usage="mine" class="border-t" />
  </Card>
</template>
