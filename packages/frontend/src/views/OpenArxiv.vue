<script setup lang="ts">
// Landing page for the browser extension's quick-open link:
//   /open/arxiv/<arxiv_id>?token=<quick-open token>
// Finds or creates the paper, then replaces this history entry with the detail page so
// the token-bearing URL does not linger. Not auth-guarded by the router (the guard would
// bounce to "/" and lose the target) — anonymous users get the login dialog instead.
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { Loader2, AlertCircle } from '@lucide/vue'
import { useAuthStore } from '@/stores/auth'
import { useLoginPrompt } from '@/composables/useLoginPrompt'
import { quickOpenApi } from '@/api/client'
import { Button } from '@/components/ui/button'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { openLogin } = useLoginPrompt()

const arxivId = computed(() => {
  const p = route.params.arxiv_id
  return Array.isArray(p) ? p.join('/') : String(p ?? '')
})
const token = computed(() => String(route.query.token ?? ''))

const status = ref<'waiting-login' | 'opening' | 'error'>('opening')
const error = ref('')
let started = false

async function open() {
  if (started) return
  started = true
  status.value = 'opening'
  try {
    if (!token.value) throw new Error('Missing quick-open token. Configure it in the browser extension options.')
    const res = await quickOpenApi.openArxiv(arxivId.value, token.value)
    await router.replace({ name: 'paper-detail', params: { id: String(res.paper_id) } })
  } catch (e: any) {
    status.value = 'error'
    error.value = e?.message || 'Failed to open paper'
  }
}

onMounted(async () => {
  if (!auth.loaded) await auth.fetchMe()
  if (auth.isAuthenticated) return open()
  status.value = 'waiting-login'
  openLogin()
})

// Continue automatically once the user logs in from the dialog.
watch(() => auth.isAuthenticated, (ok) => { if (ok && status.value === 'waiting-login') open() })
</script>

<template>
  <div class="flex min-h-[60vh] items-center justify-center p-6">
    <div class="w-full max-w-md space-y-4 text-center">
      <p class="font-mono text-sm text-muted-foreground">arXiv:{{ arxivId }}</p>

      <div v-if="status === 'opening'" class="flex items-center justify-center gap-2">
        <Loader2 class="size-5 animate-spin" />
        <span>Opening paper…</span>
      </div>

      <div v-else-if="status === 'waiting-login'" class="space-y-3">
        <p>Log in to open this paper in Paperland.</p>
        <Button @click="openLogin()">Log in</Button>
      </div>

      <div v-else class="space-y-3">
        <div class="flex items-center justify-center gap-2 text-destructive">
          <AlertCircle class="size-5" />
          <span>{{ error }}</span>
        </div>
        <Button variant="outline" as-child>
          <RouterLink to="/papers">Back to papers</RouterLink>
        </Button>
      </div>
    </div>
  </div>
</template>
