<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'
import { myTokensApi, quickOpenApi, sharingApi } from '@/api/client'
import type { MyApiTokens, SharingDataType, SharingPreferences } from '@paperland/shared'
import { Copy, Plus, RefreshCw, Trash2 } from '@lucide/vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const open = defineModel<boolean>('open', { default: false })
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
  if (!confirm('重新生成后，浏览器插件中旧的 token 将失效，需要重新填写。继续？')) return
  regenerating.value = true
  try {
    openToken.value = (await quickOpenApi.regenerateToken()).token
    toast.success('Token 已重新生成')
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
  if (!confirm('撤销后使用这个 token 的服务会立即失去访问权限。继续？')) return
  await myTokensApi.revoke(id)
  await loadTokens()
}

async function resetAgentToken() {
  if (!confirm('重置后旧的 Codex agent token 立即失效，正在运行的 Deep Research 回合后续的工具调用会失败，新回合自动使用新 token。继续？')) return
  tokenBusy.value = true
  try {
    const agent = (await myTokensApi.resetAgent()).data
    if (tokens.value) tokens.value = { ...tokens.value, agent }
    toast.success('Codex agent token 已重置')
  } finally {
    tokenBusy.value = false
  }
}

function formatTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString() : ''
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  toast.success('已复制')
}

watch(open, (o) => {
  if (o) {
    username.value = auth.user?.username ?? ''
    nickname.value = auth.user?.nickname ?? ''
    currentPassword.value = ''
    newPassword.value = ''
    error.value = ''
    loadOpenToken()
    loadSharing()
    createdToken.value = ''
    loadTokens()
  }
})

async function submit() {
  const payload: { username?: string; nickname?: string; current_password?: string; password?: string } = {}
  if (username.value && username.value !== auth.user?.username) payload.username = username.value
  if (nickname.value.trim() !== (auth.user?.nickname ?? '')) payload.nickname = nickname.value
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
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>账户设置</DialogTitle>
        <DialogDescription>修改你的用户名、昵称或密码。修改密码需要输入当前密码。</DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label for="acct-username">用户名</Label>
          <Input id="acct-username" v-model="username" autocomplete="username" />
        </div>
        <div class="space-y-2">
          <Label for="acct-nickname">昵称</Label>
          <Input id="acct-nickname" v-model="nickname" maxlength="32" autocomplete="nickname" placeholder="留空则显示用户名" />
          <p class="text-xs text-muted-foreground">其他用户在列表中看到的是你的昵称，可以与他人重复。</p>
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
      <div class="space-y-3 border-t pt-4">
        <div>
          <h3 class="text-sm font-medium">Sharing</h3>
          <p class="text-xs text-muted-foreground">开启的类型会出现在其他用户的 “All” 列表中（只读）。管理员始终可以看到所有数据；已公开发布的笔记无论此处设置都会显示。论文和预设问题始终全站共享，标签和图片始终私有。</p>
        </div>
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
      <div class="space-y-3 border-t pt-4">
        <div>
          <h3 class="text-sm font-medium">API Tokens</h3>
          <p class="text-xs text-muted-foreground">用于在其他服务中访问 Paperland：External API（如 Zotero 插件）和 MCP 服务器。以 <code>Authorization: Bearer &lt;token&gt;</code> 发送。</p>
        </div>
        <div class="space-y-2">
          <Label for="acct-mcp-url">MCP URL</Label>
          <div class="flex gap-2">
            <Input id="acct-mcp-url" :model-value="mcpUrl" readonly class="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" title="Copy" @click="copy(mcpUrl)"><Copy class="size-4" /></Button>
          </div>
        </div>
        <div v-if="createdToken" class="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
          <p class="text-xs font-medium">新 token（只显示这一次，请立即复制）</p>
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
          <p v-else class="text-xs text-muted-foreground">还没有 personal token。</p>
        </div>
        <div v-if="tokens" class="flex items-center gap-2 rounded-md border px-2 py-1.5">
          <div class="min-w-0 flex-1">
            <p class="text-xs font-medium">Codex agent token</p>
            <p class="text-xs text-muted-foreground">Deep Research 自动使用，不可查看。{{ tokens.agent.rotated_at ? `Reset ${formatTime(tokens.agent.rotated_at)}` : `Created ${formatTime(tokens.agent.created_at)}` }}</p>
          </div>
          <Button type="button" variant="outline" size="sm" :disabled="tokenBusy" @click="resetAgentToken"><RefreshCw />Reset</Button>
        </div>
      </div>
      <div class="space-y-3 border-t pt-4">
        <div>
          <h3 class="text-sm font-medium">Browser Extension</h3>
          <p class="text-xs text-muted-foreground">在插件选项中填写以下地址与 token，即可从 arxiv / Hugging Face / alphaXiv 页面一键打开论文。</p>
        </div>
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
    </DialogContent>
  </Dialog>
</template>
