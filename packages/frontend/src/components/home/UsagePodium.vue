<script setup lang="ts">
// Usage leaderboard: ranks 1–3 on a podium (2nd · 1st · 3rd), rank 4+ in a table below.
import { computed } from 'vue'
import { Crown, Medal } from '@lucide/vue'
import type { UsageLeaderboardEntry } from '@paperland/shared'
import { useAuthStore } from '@/stores/auth'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cacheShare, formatCost, formatTokens, usageDisplayName } from './usage-format'

const props = defineProps<{ entries: UsageLeaderboardEntry[] }>()
const auth = useAuthStore()

// Per-place styling; colors are tinted so they read in both themes.
const PLACES = [
  { rank: 1, step: 'h-28 sm:h-32', tint: 'bg-amber-400/20 border-amber-500/50', badge: 'bg-amber-400 text-amber-950', icon: 'text-amber-500' },
  { rank: 2, step: 'h-20 sm:h-24', tint: 'bg-slate-400/20 border-slate-400/50', badge: 'bg-slate-300 text-slate-900', icon: 'text-slate-400' },
  { rank: 3, step: 'h-14 sm:h-16', tint: 'bg-orange-500/15 border-orange-600/40', badge: 'bg-orange-400 text-orange-950', icon: 'text-orange-500' },
] as const

/** Occupied podium places in visual order: 2nd, 1st, 3rd. */
const podium = computed(() =>
  [1, 0, 2]
    .filter(i => props.entries[i])
    .map(i => ({ entry: props.entries[i], ...PLACES[i] })),
)
const rest = computed(() => props.entries.slice(3))

function isMe(e: UsageLeaderboardEntry) {
  return e.user_id != null && e.user_id === auth.user?.id
}

function initial(e: UsageLeaderboardEntry) {
  const name = e.nickname || e.username
  return name ? name.charAt(0).toUpperCase() : '?'
}
</script>

<template>
  <div>
    <div v-if="!entries.length" class="py-12 text-center text-sm text-muted-foreground">No usage recorded yet</div>
    <template v-else>
      <div class="flex items-end justify-center gap-2 px-4 pt-6 sm:gap-4">
        <div v-for="p in podium" :key="p.rank" class="flex w-28 min-w-0 flex-col items-center sm:w-40">
          <component :is="p.rank === 1 ? Crown : Medal" class="mb-1 h-5 w-5" :class="p.icon" />
          <div
            class="flex h-11 w-11 items-center justify-center rounded-full text-lg font-semibold"
            :class="[p.badge, isMe(p.entry) ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : '']"
          >{{ initial(p.entry) }}</div>
          <div class="mt-2 flex w-full items-center justify-center gap-1">
            <span class="truncate text-sm font-medium" :class="p.entry.user_id == null ? 'italic text-muted-foreground' : ''" :title="usageDisplayName(p.entry)">{{ usageDisplayName(p.entry) }}</span>
            <span v-if="isMe(p.entry)" class="shrink-0 rounded bg-primary px-1 text-[10px] font-medium text-primary-foreground">You</span>
          </div>
          <div class="text-base font-semibold">{{ formatCost(p.entry.cost_usd) }}</div>
          <div class="mb-2 text-xs text-muted-foreground" :title="`${p.entry.calls} calls`">{{ formatTokens(p.entry.total_tokens) }} tokens</div>
          <div class="flex w-full items-start justify-center rounded-t-md border border-b-0 pt-2" :class="[p.step, p.tint]">
            <span class="text-2xl font-bold text-foreground/70">{{ p.rank }}</span>
          </div>
        </div>
      </div>
      <Table v-if="rest.length" class="mt-0 border-t">
        <TableHeader>
          <TableRow>
            <TableHead class="w-10 pl-5">#</TableHead>
            <TableHead>User</TableHead>
            <TableHead class="text-right">Calls</TableHead>
            <TableHead class="text-right">Tokens</TableHead>
            <TableHead class="text-right">Cached</TableHead>
            <TableHead class="text-right pr-5">Est. cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(e, i) in rest" :key="e.user_id ?? 'none'" :class="isMe(e) ? 'bg-primary/5' : ''">
            <TableCell class="pl-5 text-muted-foreground">{{ i + 4 }}</TableCell>
            <TableCell :class="e.user_id == null ? 'text-muted-foreground italic' : ''">
              {{ usageDisplayName(e) }}
              <span v-if="isMe(e)" class="ml-1 rounded bg-primary px-1 text-[10px] font-medium text-primary-foreground">You</span>
            </TableCell>
            <TableCell class="text-right">{{ e.calls }}</TableCell>
            <TableCell class="text-right" :title="`${e.input_tokens} input / ${e.output_tokens} output`">{{ formatTokens(e.total_tokens) }}</TableCell>
            <TableCell class="text-right">{{ cacheShare(e.input_tokens, e.cached_input_tokens) }}</TableCell>
            <TableCell class="text-right pr-5 font-medium">{{ formatCost(e.cost_usd) }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </template>
  </div>
</template>
