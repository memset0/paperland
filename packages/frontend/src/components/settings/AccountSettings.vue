<script setup lang="ts">
// The signed-in user's own settings (profile, sharing, API tokens, browser extension), shown on
// the Settings page for every user. Formerly the AccountDialog.
import { ref, onMounted } from 'vue'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'
import { myTokensApi, quickOpenApi, sharingApi } from '@/api/client'
import type { MyApiTokens, SharingDataType, SharingPreferences } from '@paperland/shared'
import { Copy, Plus, RefreshCw, Trash2, UserRound, Share2, KeyRound, Puzzle } from '@lucide/vue'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const auth = useAuthStore()

const username = ref('')
const nickname = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const error = ref('')
const submitting = ref(false)

// Browser extension: site URL + per-user quick-open (CSRF) token to paste into its options.
const siteUrl = window.location.origin
const openToken = ref('')
const regenerating = ref(false)

async function loadOpenToken() {
  try { openToken.value = (await quickOpenApi.getToken()).token } catch { openToken.value = '' }
}

async function regenerateOpenToken() {
  if (!confirm('Regenerate the token? The old token in the browser extension will stop working and must be replaced.')) return
  regenerating.value = true
  try {
    openToken.value = (await quickOpenApi.regenerateToken()).token
    toast.success('Token regenerated')
  } finally {
    regenerating.value = false
  }
}

// Sharing: one switch per optionally-shared data type. On = appears in other users' "All" lists.
const SHARING_ITEMS: Array<{ key: SharingDataType; label: string }> = [
  { key: 'highlights', label: 'Highlights' },
  { key: 'notes', label: 'Notes' },
  { key: 'qa', label: 'Q&A' },
  { key: 'reference_links', label: 'Reference links' },
  { key: 'research', label: 'Research' },
]
const sharing = ref<SharingPreferences | null>(null)

async function loadSharing() {
  try { sharing.value = (await sharingApi.get()).data } catch { sharing.value = null }
}

async function toggleSharing(key: SharingDataType, value: boolean) {
  if (!sharing.value) return
  const previous = sharing.value[key]
  sharing.value = { ...sharing.value, [key]: value }
  try {
    sharing.value = (await sharingApi.update({ [key]: value })).data
  } catch {
    sharing.value = { ...sharing.value, [key]: previous }
  }
}

// API tokens: personal tokens for the External API / MCP in other tools (full value shown once),
// plus the Codex agent token Paperland injects into Deep Research runs (never shown; reset only).
const mcpUrl = `${siteUrl}/mcp`
const tokens = ref<MyApiTokens | null>(null)
const createdToken = ref('')
const tokenBusy = ref(false)

async function loadTokens() {
  try { tokens.value = (await myTokensApi.list()).data } catch { tokens.value = null }
}

async function createToken() {
  tokenBusy.value = true
  try {
    createdToken.value = (await myTokensApi.create()).data.token
    await loadTokens()
  } finally {
    tokenBusy.value = false
  }
}

async function revokeToken(id: number) {
  if (!confirm('Revoke this token? Services using it will lose access immediately.')) return
  await myTokensApi.revoke(id)
  await loadTokens()
}

async function resetAgentToken() {
  if (!confirm('Reset the Codex agent token? The old one stops working at once; tool calls in running Deep Research rounds will fail, and new rounds use the new token.')) return
  tokenBusy.value = true
  try {
    const agent = (await myTokensApi.resetAgent()).data
    if (tokens.value) tokens.value = { ...tokens.value, agent }
    toast.success('Codex agent token reset')
  } finally {
    tokenBusy.value = false
  }
}

function formatTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString() : ''
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  toast.success('Copied')
}

function resetProfileForm() {
  username.value = auth.user?.username ?? ''
  nickname.value = auth.user?.nickname ?? ''
  currentPassword.value = ''
  newPassword.value = ''
  error.value = ''
}

onMounted(() => {
  resetProfileForm()
  loadOpenToken()
  loadSharing()
  loadTokens()
})

async function submit() {
  const payload: { username?: string; nickname?: string; current_password?: string; password?: string } = {}
  if (username.value && username.value !== auth.user?.username) payload.username = username.value
  if (nickname.value.trim() !== (auth.user?.nickname ?? '')) payload.nickname = nickname.value
  if (newPassword.value) {
    if (!currentPassword.value) { error.value = 'Enter your current password to change it.'; return }
    payload.current_password = currentPassword.value
    payload.password = newPassword.value
  }
  if (Object.keys(payload).length === 0) { error.value = 'No changes to save.'; return }

  submitting.value = true
  error.value = ''
  try {
    await auth.updateAccount(payload)
    toast.success('Account updated')
    resetProfileForm()
  } catch (e: any) {
    error.value = e?.message || 'Update failed'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Card class="overflow-hidden gap-0 py-0">
    <div class="flex items-center gap-2 border-b px-5 py-3">
      <UserRound class="h-4 w-4 text-muted-foreground" />
      <h3 class="text-sm font-semibold">Account</h3>
    </div>
    <div class="space-y-3 px-5 py-4">
      <p class="text-xs text-muted-foreground">Change your username, nickname or password. Changing the password requires your current one.</p>
      <div class="max-w-sm">
        <form class="space-y-4" @submit.prevent="submit">
          <div class="space-y-2">
            <Label for="acct-username">Username</Label>
            <Input id="acct-username" v-model="username" autocomplete="username" />
          </div>
          <div class="space-y-2">
            <Label for="acct-nickname">Nickname</Label>
            <Input id="acct-nickname" v-model="nickname" maxlength="32" autocomplete="nickname" placeholder="Leave blank to show your username" />
            <p class="text-xs text-muted-foreground">Others see your nickname in lists; it doesn't have to be unique.</p>
          </div>
          <div class="space-y-2">
            <Label for="acct-current">Current password</Label>
            <Input id="acct-current" type="password" v-model="currentPassword" autocomplete="current-password" />
          </div>
          <div class="space-y-2">
            <Label for="acct-new">New password</Label>
            <Input id="acct-new" type="password" v-model="newPassword" autocomplete="new-password" placeholder="Leave blank to keep your password" />
          </div>
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
          <Button type="submit" :disabled="submitting">{{ submitting ? 'Saving…' : 'Save' }}</Button>
        </form>
      </div>
    </div>
  </Card>
  <Card class="overflow-hidden gap-0 py-0">
    <div class="flex items-center gap-2 border-b px-5 py-3">
      <Share2 class="h-4 w-4 text-muted-foreground" />
      <h3 class="text-sm font-semibold">Sharing</h3>
    </div>
    <div class="space-y-3 px-5 py-4">
      <p class="text-xs text-muted-foreground">Data types you turn on appear (read-only) in other users' "All" lists. Admins can always see everything, and published notes are always listed. Papers and preset questions are always shared; tags and images are always private.</p>
      <div v-if="sharing" class="grid grid-cols-2 gap-2">
        <label
          v-for="item in SHARING_ITEMS"
          :key="item.key"
          class="flex items-center gap-2 text-sm cursor-pointer"
        >
          <input
            type="checkbox"
            class="accent-primary"
            :checked="sharing[item.key]"
            @change="toggleSharing(item.key, ($event.target as HTMLInputElement).checked)"
          />
          {{ item.label }}
        </label>
      </div>
    </div>
  </Card>
  <Card class="overflow-hidden gap-0 py-0">
    <div class="flex items-center gap-2 border-b px-5 py-3">
      <KeyRound class="h-4 w-4 text-muted-foreground" />
      <h3 class="text-sm font-semibold">API Tokens</h3>
    </div>
    <div class="space-y-3 px-5 py-4">
      <p class="text-xs text-muted-foreground">Use these to access Paperland from other tools: the External API (e.g. the Zotero plugin) and the MCP server. Send as <code>Authorization: Bearer &lt;token&gt;</code>.</p>
      <div class="space-y-2">
        <Label for="acct-mcp-url">MCP URL</Label>
        <div class="flex gap-2">
          <Input id="acct-mcp-url" :model-value="mcpUrl" readonly class="font-mono text-xs" />
          <Button type="button" variant="outline" size="icon" title="Copy" @click="copy(mcpUrl)"><Copy class="size-4" /></Button>
        </div>
      </div>
      <div v-if="createdToken" class="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
        <p class="text-xs font-medium">New token — shown only once, copy it now</p>
        <div class="flex gap-2">
          <Input :model-value="createdToken" readonly class="font-mono text-xs" />
          <Button type="button" variant="outline" size="icon" title="Copy" @click="copy(createdToken)"><Copy class="size-4" /></Button>
        </div>
      </div>
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium">Personal tokens</span>
          <Button type="button" variant="outline" size="sm" :disabled="tokenBusy" @click="createToken"><Plus />New token</Button>
        </div>
        <div v-if="tokens?.personal.length" class="divide-y rounded-md border">
          <div v-for="t in tokens.personal" :key="t.id" class="flex items-center gap-2 px-2 py-1.5 text-xs">
            <code class="font-mono" :class="{ 'line-through text-muted-foreground': t.revoked_at }">{{ t.token }}</code>
            <span class="min-w-0 flex-1 truncate text-muted-foreground">{{ t.revoked_at ? 'Revoked' : formatTime(t.created_at) }}</span>
            <Button v-if="!t.revoked_at" type="button" variant="ghost" size="icon-sm" class="text-destructive" title="Revoke" @click="revokeToken(t.id)"><Trash2 class="size-3.5" /></Button>
          </div>
        </div>
        <p v-else class="text-xs text-muted-foreground">No personal tokens yet.</p>
      </div>
      <div v-if="tokens" class="flex items-center gap-2 rounded-md border px-2 py-1.5">
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium">Codex agent token</p>
          <p class="text-xs text-muted-foreground">Used automatically by Deep Research; cannot be viewed. {{ tokens.agent.rotated_at ? `Reset ${formatTime(tokens.agent.rotated_at)}` : `Created ${formatTime(tokens.agent.created_at)}` }}</p>
        </div>
        <Button type="button" variant="outline" size="sm" :disabled="tokenBusy" @click="resetAgentToken"><RefreshCw />Reset</Button>
      </div>
    </div>
  </Card>
  <Card class="overflow-hidden gap-0 py-0">
    <div class="flex items-center gap-2 border-b px-5 py-3">
      <Puzzle class="h-4 w-4 text-muted-foreground" />
      <h3 class="text-sm font-semibold">Browser Extension</h3>
    </div>
    <div class="space-y-3 px-5 py-4">
      <p class="text-xs text-muted-foreground">Enter this URL and token in the extension's options to open papers from arXiv / Hugging Face / alphaXiv in one click.</p>
      <div class="space-y-2">
        <Label for="acct-site-url">Site URL</Label>
        <div class="flex gap-2">
          <Input id="acct-site-url" :model-value="siteUrl" readonly class="font-mono text-xs" />
          <Button type="button" variant="outline" size="icon" title="Copy" @click="copy(siteUrl)"><Copy class="size-4" /></Button>
        </div>
      </div>
      <div class="space-y-2">
        <Label for="acct-open-token">Token</Label>
        <div class="flex gap-2">
          <Input id="acct-open-token" :model-value="openToken" readonly class="font-mono text-xs" />
          <Button type="button" variant="outline" size="icon" title="Copy" :disabled="!openToken" @click="copy(openToken)"><Copy class="size-4" /></Button>
          <Button type="button" variant="outline" size="icon" title="Regenerate" :disabled="regenerating" @click="regenerateOpenToken"><RefreshCw class="size-4" :class="{ 'animate-spin': regenerating }" /></Button>
        </div>
      </div>
    </div>
  </Card>
</template>
