<script setup lang="ts">
// The signed-in user's own model token usage and estimated cost (Settings → Account area).
import { ref, onMounted } from 'vue'
import { Gauge } from '@lucide/vue'
import type { MyUsage, UsageCategory } from '@paperland/shared'
import { usageApi } from '@/api/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { USAGE_WINDOWS, cacheShare, formatCost, formatTokens } from './usage-format'

const CATEGORY_LABELS: Record<UsageCategory, string> = { qa: 'Q&A', research: 'Deep Research', translation: 'Translation' }

const days = ref<number | undefined>(undefined)
const usage = ref<MyUsage | null>(null)

async function load() {
  try { usage.value = (await usageApi.me(days.value)).data } catch { usage.value = null }
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
        <Gauge class="h-4 w-4 text-muted-foreground" />
        <h3 class="text-sm font-semibold">Usage</h3>
      </div>
      <div class="flex gap-1">
        <Button v-for="w in USAGE_WINDOWS" :key="w.label" size="xs" :variant="days === w.days ? 'secondary' : 'ghost'" @click="pick(w.days)">{{ w.label }}</Button>
      </div>
    </div>
    <div class="space-y-3 px-5 py-4">
      <p class="text-xs text-muted-foreground">Tokens used by your model calls and their estimated cost at API rates (models without configured pricing count as $0). Calls before usage tracking started are not included.</p>
      <div v-if="usage" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><div class="text-xs text-muted-foreground">Calls</div><div class="text-lg font-semibold">{{ usage.total.calls }}</div></div>
        <div><div class="text-xs text-muted-foreground">Tokens</div><div class="text-lg font-semibold">{{ formatTokens(usage.total.total_tokens) }}</div></div>
        <div><div class="text-xs text-muted-foreground">Cached input</div><div class="text-lg font-semibold">{{ cacheShare(usage.total.input_tokens, usage.total.cached_input_tokens) }}</div></div>
        <div><div class="text-xs text-muted-foreground">Estimated cost</div><div class="text-lg font-semibold">{{ formatCost(usage.total.cost_usd) }}</div></div>
      </div>
    </div>
    <Table v-if="usage">
      <TableHeader>
        <TableRow>
          <TableHead>Category</TableHead>
          <TableHead class="text-right">Calls</TableHead>
          <TableHead class="text-right">Input</TableHead>
          <TableHead class="text-right">Output</TableHead>
          <TableHead class="text-right">Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="(label, key) in CATEGORY_LABELS" :key="key">
          <TableCell>{{ label }}</TableCell>
          <TableCell class="text-right">{{ usage.by_category[key].calls }}</TableCell>
          <TableCell class="text-right" :title="`${usage.by_category[key].cached_input_tokens} cached`">{{ formatTokens(usage.by_category[key].input_tokens) }}</TableCell>
          <TableCell class="text-right">{{ formatTokens(usage.by_category[key].output_tokens) }}</TableCell>
          <TableCell class="text-right">{{ formatCost(usage.by_category[key].cost_usd) }}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </Card>
</template>
