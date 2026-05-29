<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useLoginPrompt } from '@/composables/useLoginPrompt'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const auth = useAuthStore()
const { loginOpen, closeLogin } = useLoginPrompt()

const username = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

watch(loginOpen, (open) => {
  if (open) { error.value = ''; password.value = '' }
})

async function submit() {
  if (!username.value || !password.value) { error.value = '请输入用户名和密码'; return }
  submitting.value = true
  error.value = ''
  try {
    await auth.login(username.value, password.value)
    closeLogin()
    username.value = ''
    password.value = ''
  } catch (e: any) {
    error.value = e?.message || '登录失败'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="loginOpen">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>登录 Paperland</DialogTitle>
        <DialogDescription>登录后可添加论文、调用大模型，并管理你的标签、自由问答与高亮。</DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label for="login-username">用户名</Label>
          <Input id="login-username" v-model="username" autocomplete="username" />
        </div>
        <div class="space-y-2">
          <Label for="login-password">密码</Label>
          <Input id="login-password" type="password" v-model="password" autocomplete="current-password" />
        </div>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <Button type="submit" class="w-full" :disabled="submitting">{{ submitting ? '登录中…' : '登录' }}</Button>
      </form>
    </DialogContent>
  </Dialog>
</template>
