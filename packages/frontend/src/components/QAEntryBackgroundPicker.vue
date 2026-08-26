<script setup lang="ts">
import { Palette, X } from '@lucide/vue'
import type { QAEntryBackgroundColor } from '@paperland/shared'
import { useQAStore } from '@/stores/qa'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const props = defineProps<{
  entryId: number
  color: QAEntryBackgroundColor | null
}>()

const store = useQAStore()
const colors: Array<{ key: QAEntryBackgroundColor; label: string; dot: string }> = [
  { key: 'gray', label: '淡灰色', dot: 'bg-gray-300 dark:bg-gray-600' },
  { key: 'brown', label: '淡棕色', dot: 'bg-stone-400 dark:bg-stone-600' },
  { key: 'orange', label: '淡橙色', dot: 'bg-orange-300 dark:bg-orange-700' },
  { key: 'yellow', label: '淡黄色', dot: 'bg-yellow-300 dark:bg-yellow-700' },
  { key: 'green', label: '淡绿色', dot: 'bg-green-300 dark:bg-green-700' },
  { key: 'blue', label: '淡蓝色', dot: 'bg-blue-300 dark:bg-blue-700' },
  { key: 'purple', label: '淡紫色', dot: 'bg-purple-300 dark:bg-purple-700' },
  { key: 'pink', label: '淡粉色', dot: 'bg-pink-300 dark:bg-pink-700' },
  { key: 'red', label: '淡红色', dot: 'bg-red-300 dark:bg-red-700' },
]

function setColor(color: QAEntryBackgroundColor | null) {
  store.setEntryBackground(props.entryId, color)
}
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button
        variant="ghost" size="icon-xs" title="设置个人背景色"
        @click.stop @keydown.enter.stop @keydown.space.stop
      >
        <Palette />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-40 p-2" align="end" @click.stop>
      <div class="grid grid-cols-5 gap-1.5">
        <button
          v-for="item in colors" :key="item.key" type="button" :aria-label="item.label"
          class="h-6 w-6 rounded-full ring-offset-background transition-transform hover:scale-110"
          :class="[item.dot, color === item.key ? 'ring-2 ring-primary ring-offset-2' : 'ring-1 ring-foreground/10']"
          @click="setColor(item.key)"
        />
        <button
          type="button" aria-label="清除背景色"
          class="h-6 w-6 rounded-full border border-dashed flex items-center justify-center text-muted-foreground hover:text-foreground"
          :class="color === null ? 'ring-2 ring-primary ring-offset-2' : ''"
          @click="setColor(null)"
        ><X class="h-3 w-3" /></button>
      </div>
    </PopoverContent>
  </Popover>
</template>
