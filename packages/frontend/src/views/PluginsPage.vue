<script setup lang="ts">
// Plugins: one service per external app, the only kind of credential for apps. Each service has one
// key, usable as the service URL (/mcp/s/<key>, for apps such as ChatGPT with "No authentication"),
// as `Authorization: Bearer <key>` on /mcp and the External API, and as the Topic Git password.
import { onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Copy, Plus, RefreshCw, Trash2 } from '@lucide/vue'
import type { McpService, McpServicePermissions, McpServiceWithUrl } from '@paperland/shared'
import AppPage from '@/components/AppPage.vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { mcpServicesApi } from '@/api/client'

type PermissionKey = keyof McpServicePermissions
const PERMISSIONS: Array<{ key: PermissionKey; label: string; hint: string }> = [
  { key: 'write', label: 'Write', hint: 'Add and edit papers, save Q&A, upload images, manage Topics' },
  { key: 'delete_papers', label: 'Delete papers', hint: 'Permanently delete papers for everyone' },
  { key: 'delete_answers', label: 'Delete answers', hint: 'Delete your Q&A answers' },
]

const services = ref<McpService[]>([])
const loading = ref(true)
const busy = ref(false)
const name = ref('')
const permissions = ref<McpServicePermissions>({ write: true, delete_papers: false, delete_answers: false })
/** The key just created or rotated: shown once, with every way to use it. */
const revealed = ref<{ id: number; name: string; key: string; url: string } | null>(null)
const origin = window.location.origin
const reveal = (svc: McpServiceWithUrl) => { revealed.value = { id: svc.id, name: svc.name, key: svc.key, url: origin + svc.url_path } }

async function load() {
  try { services.value = (await mcpServicesApi.list()).data } finally { loading.value = false }
}
onMounted(load)

async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  toast.success('Copied')
}

async function create() {
  if (!name.value.trim()) return
  busy.value = true
  try {
    const svc = (await mcpServicesApi.create({ name: name.value.trim(), permissions: permissions.value })).data
    reveal(svc)
    name.value = ''
    permissions.value = { write: true, delete_papers: false, delete_answers: false }
    await load()
  } finally { busy.value = false }
}

async function toggle(svc: McpService, key: PermissionKey, value: boolean) {
  if (value && key !== 'write' && !confirm(`Allow "${svc.name}" to ${key === 'delete_papers' ? 'permanently delete papers for everyone' : 'delete your Q&A answers'}?`)) {
    await load(); return
  }
  const updated = (await mcpServicesApi.update(svc.id, { permissions: { [key]: value } })).data
  services.value = services.value.map((s) => (s.id === updated.id ? updated : s))
  toast.success('Permissions updated')
}

async function rotate(svc: McpService) {
  if (!confirm(`Generate a new key for "${svc.name}"? The current key and URL stop working immediately and the app must be updated.`)) return
  const updated = (await mcpServicesApi.rotate(svc.id)).data
  reveal(updated)
  await load()
}

async function revoke(svc: McpService) {
  if (!confirm(`Disconnect "${svc.name}"? Its key and URL stop working immediately.`)) return
  await mcpServicesApi.revoke(svc.id)
  if (revealed.value?.id === svc.id) revealed.value = null
  await load()
  toast.success('Disconnected')
}

const formatTime = (iso: string) => new Date(iso).toLocaleString()
</script>

<template>
  <AppPage>
    <div class="space-y-6">
      <p class="text-sm text-muted-foreground">Connect to your own apps.</p>

      <Card>
        <CardHeader>
          <CardTitle>New connection</CardTitle>
          <CardDescription>
            Each app gets its own key. Use it as an MCP server URL (ChatGPT: "Add custom MCP server", Authentication
            "No authentication"), as a Bearer token (Claude, Codex, the Zotero plugin, scripts) or as the Git password for
            Topics. The key works like a password: don't share it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form class="space-y-4" @submit.prevent="create">
            <div class="space-y-2">
              <Label for="plugin-name">App name</Label>
              <Input id="plugin-name" v-model="name" maxlength="60" placeholder="ChatGPT" class="max-w-sm" />
            </div>
            <fieldset class="space-y-2">
              <legend class="text-sm font-medium">Permissions</legend>
              <p class="text-xs text-muted-foreground">Reading papers, Q&A and Topics is always allowed.</p>
              <label v-for="p in PERMISSIONS" :key="p.key" class="flex items-start gap-2 text-sm cursor-pointer">
                <input v-model="permissions[p.key]" type="checkbox" class="accent-primary mt-1" />
                <span><span class="font-medium">{{ p.label }}</span> <span class="text-muted-foreground">— {{ p.hint }}</span></span>
              </label>
            </fieldset>
            <Button type="submit" :disabled="busy || !name.trim()"><Plus class="size-4" />Create connection</Button>
          </form>
        </CardContent>
      </Card>

      <Card v-if="revealed" class="border-amber-500/40 bg-amber-500/5">
        <CardHeader>
          <CardTitle>Key for "{{ revealed.name }}"</CardTitle>
          <CardDescription>Shown only once. Copy what your app needs now; you can generate a new key later.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div v-for="item in [
            { id: 'url', label: 'MCP server URL (no authentication needed)', value: revealed.url },
            { id: 'endpoint', label: 'MCP endpoint, with the header below', value: `${origin}/mcp` },
            { id: 'header', label: 'Authorization header (MCP and External API)', value: `Bearer ${revealed.key}` },
            { id: 'key', label: 'Key (Topic Git password, any username)', value: revealed.key },
          ]" :key="item.id" class="space-y-1.5">
            <Label :for="`reveal-${item.id}`">{{ item.label }}</Label>
            <div class="flex gap-2">
              <Input :id="`reveal-${item.id}`" :model-value="item.value" readonly class="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" title="Copy" :aria-label="`Copy ${item.label}`" @click="copy(item.value)"><Copy class="size-4" /></Button>
            </div>
          </div>
          <p class="text-xs text-muted-foreground">Clone a Topic with <code class="font-mono">git clone {{ origin }}/topic-git/&lt;topic id&gt;.git</code> and enter the key as the password. Pushing needs Write.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connections</CardTitle>
          <CardDescription>Q&A saved by an app is signed with its model name, e.g. "gpt-5 [MCP]"; Topic history shows which app pushed each version.</CardDescription>
        </CardHeader>
        <CardContent>
          <p v-if="loading" class="text-sm text-muted-foreground">Loading…</p>
          <p v-else-if="!services.length" class="text-sm text-muted-foreground">No connections yet.</p>
          <div v-else class="divide-y rounded-md border">
            <div v-for="svc in services" :key="svc.id" class="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
              <div class="min-w-0 flex-1 space-y-2">
                <div>
                  <p class="font-medium">{{ svc.name }}</p>
                  <p class="text-xs text-muted-foreground">
                    Created {{ formatTime(svc.created_at) }}<template v-if="svc.rotated_at"> · Key changed {{ formatTime(svc.rotated_at) }}</template>
                  </p>
                </div>
                <div class="flex flex-wrap gap-x-4 gap-y-1">
                  <label v-for="p in PERMISSIONS" :key="p.key" class="flex items-center gap-1.5 text-xs cursor-pointer" :title="p.hint">
                    <input
                      type="checkbox"
                      class="accent-primary"
                      :checked="svc.permissions[p.key]"
                      @change="toggle(svc, p.key, ($event.target as HTMLInputElement).checked)"
                    />
                    {{ p.label }}
                  </label>
                </div>
              </div>
              <div class="flex shrink-0 gap-2">
                <Button type="button" variant="outline" size="sm" @click="rotate(svc)"><RefreshCw class="size-4" />New key</Button>
                <Button type="button" variant="outline" size="sm" class="text-destructive" @click="revoke(svc)"><Trash2 class="size-4" />Disconnect</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </AppPage>
</template>
