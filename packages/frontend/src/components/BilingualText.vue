<script setup lang="ts">
import { ref, watch } from 'vue'
import { Languages, Loader2, RefreshCw } from '@lucide/vue'
import type { TranslateResponse, TranslationStreamStatus } from '@paperland/shared'
import { Button } from '@/components/ui/button'
import StreamingTranslationText from '@/components/StreamingTranslationText.vue'
import { translationApi } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useLoginPrompt } from '@/composables/useLoginPrompt'

const props = defineProps<{ text: string }>()
const auth = useAuthStore()
const { openLogin } = useLoginPrompt()

const active = ref(false)
const force = ref(false)
const requestKey = ref(0)
const loading = ref(false)
const show = ref(true)
let peekGeneration = 0

async function loadCached(): Promise<void> {
  const current = ++peekGeneration
  active.value = false
  loading.value = false
  if (!auth.isAuthenticated || !props.text.trim()) return
  try {
    const result = await translationApi.peek(props.text)
    if (current !== peekGeneration) return
    if (result.cached && result.translated_text) {
      force.value = false
      show.value = true
      requestKey.value++
      active.value = true
    }
  } catch {
    // Peek failures remain silent; the user can still request translation explicitly.
  }
}

watch([() => props.text, () => auth.isAuthenticated], loadCached, { immediate: true })

function translate(nextForce = false): void {
  if (!auth.isAuthenticated) {
    openLogin()
    return
  }
  if (loading.value || !props.text.trim()) return
  force.value = nextForce
  show.value = true
  requestKey.value++
  active.value = true
}

function onStatus(value: TranslationStreamStatus): void {
  loading.value = value === 'connecting' || value === 'streaming'
}

function onDone(_result: TranslateResponse): void {
  loading.value = false
  show.value = true
}

function onError(): void {
  loading.value = false
}
</script>

<template>
  <div class="space-y-1.5">
    <p class="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{{ text }}</p>

    <Button v-if="!active" variant="ghost" size="sm" :disabled="loading" @click="translate(false)">
      <Loader2 v-if="loading" class="animate-spin" />
      <Languages v-else />
      Translate
    </Button>

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
      <StreamingTranslationText
        v-show="show"
        :key="requestKey"
        :text="text"
        :force="force"
        as="p"
        class="text-sm leading-relaxed whitespace-pre-wrap"
        @status="onStatus"
        @done="onDone"
        @error="onError"
      />
    </div>
  </div>
</template>
