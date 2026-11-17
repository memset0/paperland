<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Loader2 } from '@lucide/vue'
import type { TopicDetail } from '@paperland/shared'
import { topicsApi } from '@/api/topics'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const props = defineProps<{ detail: TopicDetail; reload: () => Promise<void> }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ renamed: [detail: TopicDetail] }>()
const name = ref(''), base = ref(''), busy = ref(false), error = ref('')

// Each opening starts from the latest displayed title and commit (the rename's base).
watch(open, (value) => { if (value) { name.value = props.detail.snapshot.topic.title; base.value = props.detail.commit; error.value = '' } })

async function save() {
  if (!name.value.trim() || busy.value) return
  const topicId = props.detail.id
  busy.value = true; error.value = ''
  try {
    const result = await topicsApi.rename(topicId, name.value.trim(), base.value)
    if (!open.value || props.detail.id !== topicId) return
    emit('renamed', result.data); open.value = false; toast.success('Topic name updated')
  } catch (e) { error.value = (e as Error).message } finally { busy.value = false }
}
async function refreshBase() {
  await props.reload()
  base.value = props.detail.commit; error.value = ''
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Rename topic</DialogTitle>
        <DialogDescription>The new name is saved as a new version of the topic.</DialogDescription>
      </DialogHeader>
      <form id="rename-topic" class="space-y-2" @submit.prevent="save">
        <Label for="topic-name">Name</Label>
        <Input id="topic-name" v-model="name" maxlength="500" autofocus />
        <p v-if="error" role="alert" class="text-xs text-destructive">{{ error }} <button type="button" class="font-medium underline underline-offset-3" @click="refreshBase">Refresh latest</button></p>
      </form>
      <DialogFooter>
        <Button variant="outline" :disabled="busy" @click="open = false">Cancel</Button>
        <Button type="submit" form="rename-topic" :disabled="!name.trim() || busy"><Loader2 v-if="busy" class="animate-spin" />{{ busy ? 'Saving…' : 'Save name' }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
