<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Plus, Trash2 } from '@lucide/vue'
import type { TopicDefaultAccess, TopicDetail, TopicMember } from '@paperland/shared'
import { topicsApi } from '@/api/topics'
import TopicAccessSelect from '@/components/topics/TopicAccessSelect.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type Role = 'viewer' | 'editor' | 'none'
const props = defineProps<{ detail: TopicDetail; own: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ access: [value: TopicDefaultAccess] }>()
const members = ref<TopicMember[]>([]), access = ref<TopicDefaultAccess>('none'), busy = ref(false)
const username = ref(''), role = ref<Role>('viewer')
const ROLE_LABELS: Record<Role, string> = { viewer: 'Viewer', editor: 'Editor', none: 'Use general access' }

async function loadMembers() {
  const topicId = props.detail.id
  access.value = props.detail.default_access
  try { const result = await topicsApi.members(topicId); if (props.detail.id === topicId) members.value = result.data } catch {}
}
watch(open, (value) => { if (value) void loadMembers() })
watch(() => props.detail.id, () => { members.value = []; username.value = '' })

async function saveAccess() {
  if (!props.own || busy.value) return
  busy.value = true
  try {
    const result = await topicsApi.setSharing(props.detail.id, access.value)
    emit('access', result.data.default_access); await loadMembers(); toast.success('Sharing updated')
  } catch {} finally { busy.value = false }
}
async function setMember(name: string, value: Role | null) {
  if (busy.value) return
  if ((value === null || value === 'none') && !confirm(`Remove individual access to "${props.detail.snapshot.topic.title}"? They will keep any access granted by the general setting.`)) return
  const topicId = props.detail.id
  busy.value = true
  try {
    const result = await topicsApi.share(topicId, name, value === 'none' ? null : value)
    if (props.detail.id === topicId) { members.value = result.data; username.value = '' }
  } catch {} finally { busy.value = false }
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="w-full overflow-y-auto sm:max-w-md">
      <SheetHeader>
        <SheetTitle>Share topic</SheetTitle>
        <SheetDescription>Each person gets the higher of their individual and general permissions.</SheetDescription>
      </SheetHeader>
      <div class="space-y-6 px-6 pb-6">
        <section class="space-y-3">
          <TopicAccessSelect v-model="access" :disabled="!own || busy" />
          <Button v-if="own" :disabled="busy || access === detail.default_access" @click="saveAccess">{{ busy ? 'Saving…' : 'Save access' }}</Button>
          <p v-else class="text-xs text-muted-foreground">Only the owner can change sharing permissions.</p>
        </section>
        <Separator />
        <section class="space-y-3">
          <h3 class="text-sm font-medium">People with access</h3>
          <ul class="space-y-1">
            <li v-for="member in members" :key="member.user_id" class="flex min-w-0 items-center gap-3 rounded-md py-1.5">
              <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium uppercase">{{ member.display_name.slice(0, 1) }}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm">{{ member.display_name }}</span>
                <span v-if="member.effective_role !== member.role" class="block text-[11px] text-muted-foreground">Effective: <span class="capitalize">{{ member.effective_role }}</span></span>
              </span>
              <template v-if="own && member.role !== 'owner'">
                <Select :model-value="member.role" :disabled="busy" @update:model-value="setMember(member.username, $event as Role)">
                  <SelectTrigger size="sm" class="w-28" :aria-label="`Permission for ${member.display_name}`"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem v-for="(label, value) in ROLE_LABELS" :key="value" :value="value">{{ label }}</SelectItem></SelectContent>
                </Select>
                <Button variant="ghost" size="icon-sm" :disabled="busy" :title="`Remove ${member.display_name}`" :aria-label="`Remove ${member.display_name}`" @click="setMember(member.username, null)"><Trash2 /></Button>
              </template>
              <Badge v-else variant="secondary" class="capitalize">{{ member.role }}</Badge>
            </li>
          </ul>
        </section>
        <template v-if="own">
          <Separator />
          <form class="space-y-2" @submit.prevent="setMember(username.trim(), role)">
            <Label for="share-username">Add a person</Label>
            <div class="flex flex-wrap gap-2">
              <Input id="share-username" v-model="username" placeholder="Username" class="min-w-0 flex-1 basis-36" />
              <Select v-model="role">
                <SelectTrigger class="w-28" aria-label="New member permission"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem v-for="(label, value) in ROLE_LABELS" :key="value" :value="value">{{ label }}</SelectItem></SelectContent>
              </Select>
              <Button type="submit" variant="outline" :disabled="!username.trim() || busy"><Plus />Add</Button>
            </div>
          </form>
        </template>
      </div>
    </SheetContent>
  </Sheet>
</template>
