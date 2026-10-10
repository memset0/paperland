<script setup lang="ts">
// Admin: per-user model token usage and estimated cost, most expensive first.
import { ref, onMounted } from 'vue'
import { Trophy } from '@lucide/vue'
import type { UsageLeaderboardEntry } from '@paperland/shared'
import { usageApi } from '@/api/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { USAGE_WINDOWS, cacheShare, formatCost, formatTokens } from './usage-format'

const days = ref<number | undefined>(undefined)
const entries = ref<UsageLeaderboardEntry[]>([])

async function load() {
  try { entries.value = (await usageApi.leaderboard(days.value)).data } catch { entries.value = [] }
}

function pick(value: number | undefined) {
  days.value = value
  load()
}

function displayName(e: UsageLeaderboardEntry): string {
  if (e.user_id == null) return 'Unattributed'
  return e.nickname ? `${e.nickname} (${e.username})` : (e.username ?? `#${e.user_id}`)
}

onMounted(load)
</script>

<template>
  <Card class="overflow-hidden gap-0 py-0">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
      <div class="flex items-center gap-2">
        <Trophy class="h-4 w-4 text-muted-foreground" />
        <h3 class="text-sm font-semibold">Usage leaderboard</h3>
      </div>
      <div class="flex gap-1">
        <Button v-for="w in USAGE_WINDOWS" :key="w.label" size="xs" :variant="days === w.days ? 'secondary' : 'ghost'" @click="pick(w.days)">{{ w.label }}</Button>
      </div>
    </div>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-10">#</TableHead>
          <TableHead>User</TableHead>
          <TableHead class="text-right">Calls</TableHead>
          <TableHead class="text-right">Tokens</TableHead>
          <TableHead class="text-right">Cached</TableHead>
          <TableHead class="text-right">Est. cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="(e, i) in entries" :key="e.user_id ?? 'none'">
          <TableCell class="text-muted-foreground">{{ i + 1 }}</TableCell>
          <TableCell :class="e.user_id == null ? 'text-muted-foreground italic' : ''">{{ displayName(e) }}</TableCell>
          <TableCell class="text-right">{{ e.calls }}</TableCell>
          <TableCell class="text-right" :title="`${e.input_tokens} input / ${e.output_tokens} output`">{{ formatTokens(e.total_tokens) }}</TableCell>
          <TableCell class="text-right">{{ cacheShare(e.input_tokens, e.cached_input_tokens) }}</TableCell>
          <TableCell class="text-right font-medium">{{ formatCost(e.cost_usd) }}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
    <div v-if="!entries.length" class="text-center py-10 text-sm text-muted-foreground">No usage recorded yet</div>
  </Card>
</template>
