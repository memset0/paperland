<script setup lang="ts">
// Admin: recompute estimated costs of recorded model usage from stored tokens and the current
// `pricing` in config.yml, for an optional UTC day range.
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { Calculator } from '@lucide/vue'
import type { UsageRecalculateResult } from '@paperland/shared'
import { usageApi } from '@/api/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const from = ref('')
const to = ref('')
const running = ref(false)
const result = ref<UsageRecalculateResult | null>(null)

async function run() {
  if (from.value && to.value && from.value > to.value) {
    toast.error('"From" must not be after "To"')
    return
  }
  const range = from.value || to.value ? `${from.value || 'the beginning'} to ${to.value || 'today'}` : 'all time'
  if (!confirm(`Recalculate estimated costs for ${range} using the current model pricing? Existing costs in this range are overwritten.`)) return
  running.value = true
  try {
    result.value = (await usageApi.recalculate({ from: from.value || undefined, to: to.value || undefined })).data
    toast.success(`Recalculated ${result.value.updated} usage record(s)`)
  } catch {
    // The API client already shows the error.
  } finally {
    running.value = false
  }
}
</script>

<template>
  <Card class="overflow-hidden gap-0 py-0">
    <div class="flex items-center gap-2 border-b px-5 py-3">
      <Calculator class="h-4 w-4 text-muted-foreground" />
      <h3 class="text-sm font-semibold">Recalculate costs</h3>
    </div>
    <div class="space-y-3 px-5 py-4">
      <p class="text-xs text-muted-foreground">
        Recompute the estimated cost of recorded model usage from its token counts and the current <code>pricing</code> in config.yml.
        Dates are UTC days and inclusive; leave a field blank for an open range. Records of models that are no longer configured or have no pricing are left unchanged.
      </p>
      <div class="flex flex-wrap items-end gap-3">
        <div class="space-y-1">
          <Label for="recalc-from" class="text-xs">From (UTC)</Label>
          <Input id="recalc-from" v-model="from" type="date" class="w-40" />
        </div>
        <div class="space-y-1">
          <Label for="recalc-to" class="text-xs">To (UTC)</Label>
          <Input id="recalc-to" v-model="to" type="date" class="w-40" />
        </div>
        <Button size="sm" :disabled="running" @click="run">{{ running ? 'Recalculating…' : 'Recalculate' }}</Button>
      </div>
      <p v-if="result" class="text-xs text-muted-foreground">
        Updated {{ result.updated }} record(s).
        <template v-if="result.skipped">Skipped {{ result.skipped }} without pricing: {{ result.skipped_models.join(', ') }}.</template>
      </p>
    </div>
  </Card>
</template>
