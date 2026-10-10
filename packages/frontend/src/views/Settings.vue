<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { usersApi } from '@/api/client'
import type { User, UserRole } from '@paperland/shared'
import { toast } from 'vue-sonner'
import { Key, Plus, Trash2, Copy, Check, Users, ShieldCheck, Shield, KeyRound, Pencil, UserCheck, UserX } from '@lucide/vue'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AppPage from '@/components/AppPage.vue'
import InstallAppCard from '@/components/settings/InstallAppCard.vue'
import AccountSettings from '@/components/settings/AccountSettings.vue'
import { usePendingRegistrations } from '@/composables/usePendingRegistrations'

const store = useSettingsStore()
const auth = useAuthStore()
const newToken = ref<string | null>(null)
const issuing = ref(false)
const copied = ref(false)

// ── Users ──
const users = ref<User[]>([])
const { setPendingCount } = usePendingRegistrations()
async function fetchUsers() {
  try {
    users.value = (await usersApi.list()).data
    setPendingCount(users.value.filter((u) => u.status === 'pending').length)
  } catch {}
}
// Pending self-registrations first (oldest first), then everyone else in id order.
const sortedUsers = computed(() => [
  ...users.value.filter((u) => u.status === 'pending'),
  ...users.value.filter((u) => u.status !== 'pending'),
])

async function approve(u: User) {
  try {
    await usersApi.approve(u.id)
    toast.success(`Approved ${u.username}`)
    await fetchUsers()
  } catch { /* handled */ }
}

async function reject(u: User) {
  if (!window.confirm(`Reject the registration of "${u.username}"? The request will be deleted.`)) return
  try {
    await usersApi.reject(u.id)
    toast.success(`Rejected ${u.username}`)
    await fetchUsers()
  } catch { /* handled */ }
}

const showCreate = ref(false)
const createForm = ref<{ username: string; password: string; admin: boolean }>({ username: '', password: '', admin: false })
const creating = ref(false)
async function createUser() {
  if (!createForm.value.username || !createForm.value.password) { toast.error('Enter a username and password.'); return }
  creating.value = true
  try {
    await usersApi.create({ username: createForm.value.username, password: createForm.value.password, role: createForm.value.admin ? 'admin' : 'user' })
    toast.success('User created')
    showCreate.value = false
    createForm.value = { username: '', password: '', admin: false }
    await fetchUsers()
  } catch { /* error toast handled by client */ } finally { creating.value = false }
}

async function toggleRole(u: User) {
  const next: UserRole = u.role === 'admin' ? 'user' : 'admin'
  try {
    await usersApi.update(u.id, { role: next })
    toast.success(`${u.username} is now ${next === 'admin' ? 'an admin' : 'a user'}`)
    await fetchUsers()
  } catch { /* handled */ }
}

const showReset = ref(false)
const resetTarget = ref<User | null>(null)
const resetPw = ref('')
function openReset(u: User) { resetTarget.value = u; resetPw.value = ''; showReset.value = true }
async function doReset() {
  if (!resetTarget.value || !resetPw.value) { toast.error('Enter a new password.'); return }
  try {
    await usersApi.update(resetTarget.value.id, { password: resetPw.value })
    toast.success('Password reset')
    showReset.value = false
  } catch { /* handled */ }
}

const showNickname = ref(false)
const nicknameTarget = ref<User | null>(null)
const nicknameInput = ref('')
function openNickname(u: User) { nicknameTarget.value = u; nicknameInput.value = u.nickname ?? ''; showNickname.value = true }
async function saveNickname() {
  if (!nicknameTarget.value) return
  try {
    await usersApi.update(nicknameTarget.value.id, { nickname: nicknameInput.value })
    toast.success('Nickname updated')
    showNickname.value = false
    await fetchUsers()
  } catch { /* handled */ }
}

// Admin-only data: never request it for regular users (the endpoints would answer 403).
onMounted(() => { if (auth.isAdmin) { store.fetchTokens(); fetchUsers() } })

async function issueNew() {
  issuing.value = true
  try {
    newToken.value = await store.issueToken()
  } finally {
    issuing.value = false
  }
}

function copyToken() {
  if (newToken.value) {
    navigator.clipboard.writeText(newToken.value)
    copied.value = true
    setTimeout(() => copied.value = false, 2000)
  }
}
</script>

<template>
  <AppPage>
    <div class="space-y-6">
    <!-- Order: Install app → the user's own account settings → administration (admins only) -->
    <InstallAppCard />
    <AccountSettings />

    <template v-if="auth.isAdmin">
    <h2 class="flex items-center gap-2 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <ShieldCheck class="h-3.5 w-3.5" />Administration
    </h2>
    <!-- ── User management (admin only) ── -->
    <Card class="overflow-hidden gap-0 py-0">
      <div class="flex items-center justify-between border-b px-5 py-3">
        <div class="flex items-center gap-2">
          <Users class="h-4 w-4 text-muted-foreground" />
          <h3 class="text-sm font-semibold">User management</h3>
        </div>
        <Button size="sm" @click="showCreate = true">
          <Plus />Add user
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Nickname</TableHead>
            <TableHead class="w-28">Role</TableHead>
            <TableHead class="w-40">Created</TableHead>
            <TableHead class="w-64 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="u in sortedUsers" :key="u.id" :class="u.status === 'pending' && 'bg-amber-500/5'">
            <TableCell class="font-medium">
              {{ u.username }}
              <Badge v-if="u.status === 'pending'" variant="outline" class="ml-1.5 border-amber-500/50 text-amber-600 dark:text-amber-400">Pending</Badge>
            </TableCell>
            <TableCell class="text-sm" :class="!u.nickname && 'text-muted-foreground'">{{ u.nickname || '—' }}</TableCell>
            <TableCell>
              <Badge :variant="u.role === 'admin' ? 'default' : 'secondary'" class="gap-1">
                <ShieldCheck v-if="u.role === 'admin'" class="h-3 w-3" />
                <Shield v-else class="h-3 w-3" />
                {{ u.role === 'admin' ? 'Admin' : 'User' }}
              </Badge>
            </TableCell>
            <TableCell class="text-xs text-muted-foreground">{{ new Date(u.created_at).toLocaleString() }}</TableCell>
            <TableCell v-if="u.status === 'pending'" class="text-right space-x-1">
              <Button size="xs" @click="approve(u)"><UserCheck />Approve</Button>
              <Button variant="ghost" size="xs" class="text-destructive" @click="reject(u)"><UserX />Reject</Button>
            </TableCell>
            <TableCell v-else class="text-right space-x-1">
              <Button variant="ghost" size="xs" @click="toggleRole(u)">
                {{ u.role === 'admin' ? 'Remove admin' : 'Make admin' }}
              </Button>
              <Button variant="ghost" size="xs" @click="openNickname(u)">
                <Pencil />Nickname
              </Button>
              <Button variant="ghost" size="xs" @click="openReset(u)">
                <KeyRound />Reset password
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <div v-if="!users.length" class="text-center py-10 text-sm text-muted-foreground">No users</div>
    </Card>

    <!-- ── API Token ── -->
    <Card class="overflow-hidden gap-0 py-0">
      <div class="flex items-center justify-between border-b px-5 py-3">
        <div class="flex items-center gap-2">
          <Key class="h-4 w-4 text-muted-foreground" />
          <h3 class="text-sm font-semibold">All API Tokens</h3>
        </div>
        <Button size="sm" :disabled="issuing" @click="issueNew">
          <Plus />Issue token
        </Button>
      </div>

      <Alert v-if="newToken" class="m-5">
        <Check />
        <AlertTitle>New token created (shown only once)</AlertTitle>
        <AlertDescription>
          <div class="flex items-center gap-2 w-full">
            <code class="flex-1 rounded-md bg-muted px-3 py-1.5 text-xs font-mono break-all select-all">{{ newToken }}</code>
            <Button variant="ghost" size="icon-sm" @click="copyToken">
              <Check v-if="copied" class="text-emerald-500" />
              <Copy v-else />
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Token</TableHead>
            <TableHead class="w-40">Created</TableHead>
            <TableHead class="w-24">Status</TableHead>
            <TableHead class="w-20 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="t in store.tokens" :key="t.id">
            <TableCell>
              <code v-if="t.token" class="text-xs font-mono bg-muted rounded px-1.5 py-0.5">{{ t.token }}</code>
              <span v-else class="text-xs text-muted-foreground">Hidden</span>
              <Badge v-if="t.kind === 'agent'" variant="outline" class="ml-2" title="One per user, used by Codex in Deep Research; only its owner can reset it">Codex agent</Badge>
            </TableCell>
            <TableCell class="text-xs text-muted-foreground">{{ new Date(t.created_at).toLocaleString() }}</TableCell>
            <TableCell>
              <Badge :variant="t.revoked_at ? 'destructive' : 'secondary'">
                {{ t.revoked_at ? 'Revoked' : 'Active' }}
              </Badge>
            </TableCell>
            <TableCell class="text-right">
              <Button v-if="!t.revoked_at && t.kind !== 'agent'" variant="ghost" size="xs" class="text-destructive" @click="store.revokeToken(t.id)">
                <Trash2 />Revoke
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <div v-if="!store.tokens.length" class="text-center py-10 text-sm text-muted-foreground">No tokens</div>
    </Card>


    </template>

    <!-- Create user dialog -->
    <Dialog v-model:open="showCreate">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>Create an account with an initial password. The user can change it after logging in.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="createUser">
          <div class="space-y-2">
            <Label for="nu-name">Username</Label>
            <Input id="nu-name" v-model="createForm.username" autocomplete="off" />
          </div>
          <div class="space-y-2">
            <Label for="nu-pw">Initial password</Label>
            <Input id="nu-pw" type="password" v-model="createForm.password" autocomplete="new-password" />
          </div>
          <div class="space-y-2">
            <Label>Role</Label>
            <div class="flex gap-2">
              <Button type="button" size="sm" :variant="!createForm.admin ? 'secondary' : 'outline'" @click="createForm.admin = false">User</Button>
              <Button type="button" size="sm" :variant="createForm.admin ? 'secondary' : 'outline'" @click="createForm.admin = true">Admin</Button>
            </div>
          </div>
          <Button type="submit" class="w-full" :disabled="creating">{{ creating ? 'Creating…' : 'Create user' }}</Button>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Reset password dialog -->
    <Dialog v-model:open="showNickname">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit nickname</DialogTitle>
          <DialogDescription>Set a nickname for {{ nicknameTarget?.username }}. Leave blank to show the username.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="saveNickname">
          <div class="space-y-2">
            <Label for="nn-input">Nickname</Label>
            <Input id="nn-input" v-model="nicknameInput" maxlength="32" autocomplete="off" />
          </div>
          <Button type="submit" class="w-full">Save</Button>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showReset">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>Set a new password for {{ resetTarget?.username }}.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="doReset">
          <div class="space-y-2">
            <Label for="rp-pw">New password</Label>
            <Input id="rp-pw" type="password" v-model="resetPw" autocomplete="new-password" />
          </div>
          <Button type="submit" class="w-full">Reset password</Button>
        </form>
      </DialogContent>
    </Dialog>
    </div>
  </AppPage>
</template>
