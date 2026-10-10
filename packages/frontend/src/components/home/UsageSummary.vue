<script setup lang="ts">
// The signed-in user's own model usage for the window chosen in UsageDashboard.
import type { MyUsage, UsageCategory } from '@paperland/shared'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cacheShare, formatCost, formatTokens } from './usage-format'

defineProps<{ usage: MyUsage | null }>()

const CATEGORY_LABELS: Record<UsageCategory, string> = { qa: 'Q&A', research: 'Deep Research', translation: 'Translation' }
</script>

<template>
  <div>
    <div class="px-5 py-4 space-y-3">
      <h4 class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your usage</h4>
      <div v-if="usage" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><div class="text-xs text-muted-foreground">Calls</div><div class="text-lg font-semibold">{{ usage.total.calls }}</div></div>
        <div><div class="text-xs text-muted-foreground">Tokens</div><div class="text-lg font-semibold">{{ formatTokens(usage.total.total_tokens) }}</div></div>
        <div><div class="text-xs text-muted-foreground">Cached input</div><div class="text-lg font-semibold">{{ cacheShare(usage.total.input_tokens, usage.total.cached_input_tokens) }}</div></div>
        <div><div class="text-xs text-muted-foreground">Estimated cost</div><div class="text-lg font-semibold">{{ formatCost(usage.total.cost_usd) }}</div></div>
      </div>
      <p class="text-xs text-muted-foreground">Estimated at API rates (models without configured pricing count as $0). Calls before usage tracking started are not included.</p>
    </div>
    <Table v-if="usage">
      <TableHeader>
        <TableRow>
          <TableHead class="pl-5">Category</TableHead>
          <TableHead class="text-right">Calls</TableHead>
          <TableHead class="text-right">Input</TableHead>
          <TableHead class="text-right">Output</TableHead>
          <TableHead class="text-right pr-5">Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="(label, key) in CATEGORY_LABELS" :key="key">
          <TableCell class="pl-5">{{ label }}</TableCell>
          <TableCell class="text-right">{{ usage.by_category[key].calls }}</TableCell>
          <TableCell class="text-right" :title="`${usage.by_category[key].cached_input_tokens} cached`">{{ formatTokens(usage.by_category[key].input_tokens) }}</TableCell>
          <TableCell class="text-right">{{ formatTokens(usage.by_category[key].output_tokens) }}</TableCell>
          <TableCell class="text-right pr-5">{{ formatCost(usage.by_category[key].cost_usd) }}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
