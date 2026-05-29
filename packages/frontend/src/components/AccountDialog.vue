<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const open = defineModel<boolean>('open', { default: false })
const auth = useAuthStore()

const username = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const error = ref('')
const submitting = ref(false)

watch(open, (o) => {
  if (o) {
    username.value = auth.user?.username ?? ''
    currentPassword.value = ''
    newPassword.value = ''
    error.value = ''
  }
})

async function submit() {
  const payload: { username?: string; current_password?: string; password?: string } = {}
  if (username.value && username.value !== auth.user?.username) payload.username = username.value
  if (newPassword.value) {
    if (!currentPassword.value) { error.value = '修改密码需要输入当前密码'; return }
    payload.current_password = currentPassword.value
    payload.password = newPassword.value
  }
  if (Object.keys(payload).length === 0) { error.value = '没有需要保存的修改'; return }

  submitting.value = true
  error.value = ''
  try {
    await auth.updateAccount(payload)
    toast.success('账户已更新')
    open.value = false
  } catch (e: any) {
    error.value = e?.message || '更新失败'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>账户设置</DialogTitle>
        <DialogDescription>修改你的用户名或密码。修改密码需要输入当前密码。</DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label for="acct-username">用户名</Label>
          <Input id="acct-username" v-model="username" autocomplete="username" />
        </div>
        <div class="space-y-2">
          <Label for="acct-current">当前密码</Label>
          <Input id="acct-current" type="password" v-model="currentPassword" autocomplete="current-password" />
        </div>
        <div class="space-y-2">
          <Label for="acct-new">新密码</Label>
          <Input id="acct-new" type="password" v-model="newPassword" autocomplete="new-password" placeholder="留空则不修改密码" />
        </div>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <Button type="submit" class="w-full" :disabled="submitting">{{ submitting ? '保存中…' : '保存' }}</Button>
      </form>
    </DialogContent>
  </Dialog>
</template>
