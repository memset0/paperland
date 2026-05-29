<script setup lang="ts">
import { ref } from 'vue'
import { type QAResult } from '@/stores/qa'
import { RefreshCw, Copy, Check, Trash2, Pin } from '@lucide/vue'
import MarkdownContent from './MarkdownContent.vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

const props = defineProps<{
  results: QAResult[]
  entryKey: string
  paperId: number
  highlightPathname?: string
}>()

const emit = defineEmits<{
  regenerate: [modelName: string]
  deleteResult: [resultId: number]
}>()

const copiedId = ref<number | null>(null)

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

function pinKey(entryKey: string) { return `qa-pin-${props.paperId}-${entryKey}` }
function getPinnedModel(): string | null { return localStorage.getItem(pinKey(props.entryKey)) }
function pinResult(modelName: string) {
  const current = getPinnedModel()
  if (current === modelName) {
    localStorage.removeItem(pinKey(props.entryKey))
  } else {
    localStorage.setItem(pinKey(props.entryKey), modelName)
  }
}

function sortedResults(): QAResult[] {
  const pinned = getPinnedModel()
  return [...props.results].sort((a, b) => {
    if (pinned) {
      if (a.model_name === pinned && b.model_name !== pinned) return -1
      if (b.model_name === pinned && a.model_name !== pinned) return 1
    }
    return new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
  })
}

const activeTab = ref<string>('')

function copyAnswer(resultId: number, text: string) {
  navigator.clipboard.writeText(text)
  copiedId.value = resultId
  setTimeout(() => { copiedId.value = null }, 2000)
}
</script>

<template>
  <Tabs v-if="results.length > 1" v-model="activeTab" :default-value="String(sortedResults()[0].id)">
    <TabsList class="w-full justify-start overflow-x-auto">
      <TabsTrigger v-for="r in sortedResults()" :key="r.id" :value="String(r.id)">
        <span class="flex flex-col items-start">
          <span>{{ r.model_name }}</span>
          <span class="text-[10px] opacity-70">{{ timeAgo(r.completed_at) }}</span>
        </span>
      </TabsTrigger>
    </TabsList>
    <TabsContent v-for="r in sortedResults()" :key="r.id" :value="String(r.id)">
      <MarkdownContent :content="r.answer" :highlight-pathname="highlightPathname" class="text-sm" />
      <div class="flex items-center gap-1 mt-3 pt-2 border-t">
        <Button
          variant="ghost"
          size="icon-xs"
          :title="getPinnedModel() === r.model_name ? '取消置顶' : '置顶'"
          :class="getPinnedModel() === r.model_name ? 'text-primary' : ''"
          @click="pinResult(r.model_name)"
        >
          <Pin />
        </Button>
        <Button variant="ghost" size="icon-xs" @click="copyAnswer(r.id, r.answer)">
          <Check v-if="copiedId === r.id" />
          <Copy v-else />
        </Button>
        <Button variant="ghost" size="icon-xs" @click="emit('regenerate', r.model_name)">
          <RefreshCw />
        </Button>
        <Button variant="ghost" size="icon-xs" @click="emit('deleteResult', r.id)" class="hover:text-destructive">
          <Trash2 />
        </Button>
      </div>
    </TabsContent>
  </Tabs>

  <div v-else-if="results.length === 1">
    <MarkdownContent :content="results[0].answer" :highlight-pathname="highlightPathname" class="text-sm" />
    <div class="flex items-center justify-between mt-3 pt-2 border-t">
      <div class="flex items-center gap-2">
        <Badge variant="secondary">{{ results[0].model_name }}</Badge>
        <span class="text-[10px] text-muted-foreground">{{ timeAgo(results[0].completed_at) }}</span>
      </div>
      <div class="flex items-center gap-1">
        <Button variant="ghost" size="icon-xs" @click="copyAnswer(results[0].id, results[0].answer)">
          <Check v-if="copiedId === results[0].id" />
          <Copy v-else />
        </Button>
        <Button variant="ghost" size="icon-xs" @click="emit('regenerate', results[0].model_name)">
          <RefreshCw />
        </Button>
        <Button variant="ghost" size="icon-xs" @click="emit('deleteResult', results[0].id)" class="hover:text-destructive">
          <Trash2 />
        </Button>
      </div>
    </div>
  </div>
</template>
