<script setup lang="ts">
// Browser extension: personalized download (site URL + quick-open token baked into
// src/preset.json), install steps, token management and supported sites.
import { ref, onMounted } from 'vue'
import { toast } from 'vue-sonner'
import { Download, Copy, RefreshCw } from '@lucide/vue'
import AppPage from '@/components/AppPage.vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { extensionApi, quickOpenApi } from '@/api/client'

const siteUrl = window.location.origin
const downloadUrl = extensionApi.downloadUrl(siteUrl)
const token = ref('')
const regenerating = ref(false)

onMounted(async () => {
  try { token.value = (await quickOpenApi.getToken()).token } catch { token.value = '' }
})

async function regenerate() {
  if (!confirm('Regenerate the token? The extension stops working until you update it (or reinstall a fresh download).')) return
  regenerating.value = true
  try {
    token.value = (await quickOpenApi.regenerateToken()).token
    toast.success('Token regenerated')
  } finally {
    regenerating.value = false
  }
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  toast.success('Copied')
}

const SITES = [
  { name: 'arXiv', urls: 'arxiv.org/abs/…, /pdf/…, /html/…' },
  { name: 'Hugging Face', urls: 'huggingface.co/papers/…' },
  { name: 'alphaXiv', urls: 'alphaxiv.org/abs/…, /overview/…, /pdf/…' },
  { name: 'Other pages', urls: 'with a citation_arxiv_id meta tag' },
]
</script>

<template>
  <AppPage>
    <div class="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Download</CardTitle>
          <CardDescription>
            Open the arXiv paper you are reading in Paperland with one click — it is added to the library automatically
            if it is not there yet. Works in Chrome, Edge and Firefox.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <Button as-child>
            <a :href="downloadUrl" download>
              <Download class="size-4" />
              Download extension (.zip)
            </a>
          </Button>
          <p class="text-xs text-muted-foreground">
            The download is pre-configured with this site's URL and your personal token, so it works right after
            installing. Don't share the file with others.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Install</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs default-value="chromium">
            <TabsList>
              <TabsTrigger value="chromium">Chrome / Edge</TabsTrigger>
              <TabsTrigger value="firefox">Firefox</TabsTrigger>
            </TabsList>
            <TabsContent value="chromium">
              <ol class="list-decimal space-y-1 pl-5 text-sm">
                <li>Unzip the downloaded file into a folder you will keep (the browser loads it from there).</li>
                <li>Open <code>chrome://extensions</code> (Edge: <code>edge://extensions</code>) and turn on <b>Developer mode</b>.</li>
                <li>Click <b>Load unpacked</b> and select the unzipped folder.</li>
                <li>Optionally pin the Paperland button to the toolbar.</li>
              </ol>
            </TabsContent>
            <TabsContent value="firefox">
              <ol class="list-decimal space-y-1 pl-5 text-sm">
                <li>Open <code>about:debugging#/runtime/this-firefox</code>.</li>
                <li>Click <b>Load Temporary Add-on…</b> and select the downloaded <code>.zip</code> file.</li>
                <li>Temporary add-ons are removed when Firefox restarts — load it again after a restart.</li>
              </ol>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Use</CardTitle>
        </CardHeader>
        <CardContent class="space-y-3 text-sm">
          <p>On a paper page, click the Paperland toolbar button or press <kbd class="rounded border px-1 font-mono text-xs">Alt+Shift+P</kbd>.</p>
          <table class="w-full text-left">
            <tbody>
              <tr v-for="site in SITES" :key="site.name" class="border-t">
                <td class="py-1.5 pr-4 font-medium whitespace-nowrap">{{ site.name }}</td>
                <td class="py-1.5 text-muted-foreground">{{ site.urls }}</td>
              </tr>
            </tbody>
          </table>
          <p class="text-muted-foreground">If no arXiv id is found, the button briefly shows a “?” badge.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Already embedded in the download. Paste these into the extension's options page if you load it from the
            repository or after regenerating the token.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label for="ext-site-url">Site URL</Label>
            <div class="flex gap-2">
              <Input id="ext-site-url" :model-value="siteUrl" readonly class="font-mono text-xs" />
              <Button variant="outline" size="icon" title="Copy" @click="copy(siteUrl)"><Copy class="size-4" /></Button>
            </div>
          </div>
          <div class="space-y-2">
            <Label for="ext-token">Token</Label>
            <div class="flex gap-2">
              <Input id="ext-token" :model-value="token" readonly class="font-mono text-xs" />
              <Button variant="outline" size="icon" title="Copy" :disabled="!token" @click="copy(token)"><Copy class="size-4" /></Button>
              <Button variant="outline" size="icon" title="Regenerate" :disabled="regenerating" @click="regenerate">
                <RefreshCw class="size-4" :class="{ 'animate-spin': regenerating }" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </AppPage>
</template>
