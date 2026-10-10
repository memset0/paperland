<script setup lang="ts">
import { ref } from 'vue'
import { BookOpen } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

// Full-page Login / Register screen shown instead of the app to anonymous visitors (the site is
// members-only). Logging in just sets the user: App then renders the route that was requested.
// Registering creates a pending account that an admin approves in Settings.
const auth = useAuthStore()
const tab = ref<'login' | 'register'>('login')

const loginForm = ref({ username: '', password: '' })
const loginError = ref('')
const loggingIn = ref(false)
const notice = ref('')

async function submitLogin() {
  if (!loginForm.value.username || !loginForm.value.password) { loginError.value = 'Enter your username and password.'; return }
  loggingIn.value = true
  loginError.value = ''
  try {
    await auth.login(loginForm.value.username, loginForm.value.password)
  } catch (e: any) {
    loginError.value = e?.message || 'Login failed'
  } finally {
    loggingIn.value = false
  }
}

const regForm = ref({ username: '', nickname: '', password: '', confirm: '' })
const regError = ref('')
const registering = ref(false)

async function submitRegister() {
  const f = regForm.value
  if (!f.username.trim() || !f.password) { regError.value = 'Username and password are required.'; return }
  if (f.password !== f.confirm) { regError.value = 'Passwords do not match.'; return }
  registering.value = true
  regError.value = ''
  try {
    await auth.register({ username: f.username.trim(), password: f.password, nickname: f.nickname.trim() || null })
    notice.value = 'Registration submitted. You can log in once an admin approves your account.'
    loginForm.value = { username: f.username.trim(), password: '' }
    regForm.value = { username: '', nickname: '', password: '', confirm: '' }
    tab.value = 'login'
  } catch (e: any) {
    regError.value = e?.message || 'Registration failed'
  } finally {
    registering.value = false
  }
}
</script>

<template>
  <div class="flex min-h-full w-full items-center justify-center px-4 py-10">
    <Card class="w-full max-w-sm gap-0 p-6">
      <div class="mb-5 flex items-center gap-2">
        <BookOpen class="h-5 w-5 text-primary" />
        <span class="text-lg font-semibold">Paperland</span>
      </div>
      <p class="mb-4 text-sm text-muted-foreground">Log in to continue. New here? Register and wait for an admin to approve your account.</p>

      <Tabs v-model="tab">
        <TabsList class="mb-4 grid w-full" :class="auth.registrationEnabled ? 'grid-cols-2' : 'grid-cols-1'">
          <TabsTrigger value="login">Log in</TabsTrigger>
          <TabsTrigger v-if="auth.registrationEnabled" value="register">Register</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <form class="space-y-4" @submit.prevent="submitLogin">
            <p v-if="notice" class="rounded-md bg-muted px-3 py-2 text-sm">{{ notice }}</p>
            <div class="space-y-2">
              <Label for="auth-username">Username</Label>
              <Input id="auth-username" v-model="loginForm.username" autocomplete="username" />
            </div>
            <div class="space-y-2">
              <Label for="auth-password">Password</Label>
              <Input id="auth-password" v-model="loginForm.password" type="password" autocomplete="current-password" />
            </div>
            <p v-if="loginError" class="text-sm text-destructive">{{ loginError }}</p>
            <Button type="submit" class="w-full" :disabled="loggingIn">{{ loggingIn ? 'Logging in…' : 'Log in' }}</Button>
          </form>
        </TabsContent>

        <TabsContent v-if="auth.registrationEnabled" value="register">
          <form class="space-y-4" @submit.prevent="submitRegister">
            <div class="space-y-2">
              <Label for="reg-username">Username</Label>
              <Input id="reg-username" v-model="regForm.username" autocomplete="username" maxlength="64" />
            </div>
            <div class="space-y-2">
              <Label for="reg-nickname">Nickname <span class="text-muted-foreground">(optional)</span></Label>
              <Input id="reg-nickname" v-model="regForm.nickname" maxlength="32" />
            </div>
            <div class="space-y-2">
              <Label for="reg-password">Password</Label>
              <Input id="reg-password" v-model="regForm.password" type="password" autocomplete="new-password" />
            </div>
            <div class="space-y-2">
              <Label for="reg-confirm">Confirm password</Label>
              <Input id="reg-confirm" v-model="regForm.confirm" type="password" autocomplete="new-password" />
            </div>
            <p v-if="regError" class="text-sm text-destructive">{{ regError }}</p>
            <Button type="submit" class="w-full" :disabled="registering">{{ registering ? 'Submitting…' : 'Register' }}</Button>
          </form>
        </TabsContent>
      </Tabs>
    </Card>
  </div>
</template>
