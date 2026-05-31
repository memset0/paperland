<script setup lang="ts">
import { ref, watch } from 'vue'
import { Languages, Loader2, RefreshCw } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { translationApi } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useLoginPrompt } from '@/composables/useLoginPrompt'

// Shows a piece of plain text (English) and, on demand, its Chinese translation below.
// Plain text only — no Markdown rendering. Translation is gated to logged-in users; the cache
// behind /api/translate is shared across all users. If the text was already translated before,
// the backend (via the cache_only peek) tells us so and we show it expanded by default — no AI call.
const props = defineProps<{ text: string }>()

const auth = useAuthStore()
const { openLogin } = useLoginPrompt()

const translated = ref<string | null>(null)
const loading = ref(false)
const show = ref(true)

// On mount / when the text or auth state changes: ask the backend whether this text already has a
// cached translation (cache_only peek — no AI call, no 404). If so, show it expanded by default.
async function loadCached(): Promise<void> {
  translated.value = null
  if (!auth.isAuthenticated || !props.text.trim()) return
  try {
    const res = await translationApi.peek(props.text)
    if (res.cached && res.translated_text) {
      translated.value = res.translated_text
      show.value = true
    }
  } catch {
    // peek failed (e.g. session expired) — stay collapsed silently
  }
}

watch([() => props.text, () => auth.isAuthenticated], loadCached, { immediate: true })

async function translate(force = false): Promise<void> {
  if (!auth.isAuthenticated) {
    openLogin()
    return
  }
  if (loading.value) return
  loading.value = true
  try {
    const res = await translationApi.translate(props.text, force)
    translated.value = res.translated_text
    show.value = true
  } catch {
    // errors surface via the API client's toast; keep the current state
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-1.5">
    <!-- Original English (plain text, line breaks preserved) -->
    <p class="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{{ text }}</p>

    <!-- Before any translation: a single Translate button -->
    <Button
      v-if="translated === null"
      variant="ghost"
      size="sm"
      :disabled="loading"
      @click="translate(false)"
    >
      <Loader2 v-if="loading" class="animate-spin" />
      <Languages v-else />
      Translate
    </Button>

    <!-- After translation: compact header row (label + small inline controls), then the Chinese -->
    <div v-else class="space-y-1 border-l-2 border-border pl-3">
      <div class="flex items-center gap-1.5">
        <span class="text-[0.625rem] font-medium uppercase tracking-wider text-muted-foreground/70">Translation</span>
        <Button variant="ghost" size="xs" @click="show = !show">{{ show ? 'Hide' : 'Show' }}</Button>
        <Button variant="ghost" size="xs" :disabled="loading" @click="translate(true)">
          <Loader2 v-if="loading" class="animate-spin" />
          <RefreshCw v-else />
          Re-translate
        </Button>
      </div>
      <p v-if="show" class="text-sm leading-relaxed whitespace-pre-wrap">{{ translated }}</p>
    </div>
  </div>
</template>
