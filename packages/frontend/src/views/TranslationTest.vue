<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  TranslateResponse,
  TranslationStreamStart,
  TranslationStreamStatus,
} from '@paperland/shared'
import AppPage from '@/components/AppPage.vue'
import StreamingTranslationText from '@/components/StreamingTranslationText.vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const draft = ref('Streaming translation lets readers see useful output before generation finishes.')
const submitted = ref('')
const forceDraft = ref(false)
const submittedForce = ref(false)
const requestKey = ref(0)
const status = ref<TranslationStreamStatus>('idle')
const cached = ref<boolean | null>(null)
const providerStreaming = ref<boolean | null>(null)
const modelName = ref<string | null>(null)
const error = ref<string | null>(null)

const canStart = computed(() => draft.value.trim().length > 0 && !['connecting', 'streaming'].includes(status.value))

function start(): void {
  if (!canStart.value) return
  submitted.value = draft.value.trim()
  submittedForce.value = forceDraft.value
  status.value = 'connecting'
  cached.value = null
  providerStreaming.value = null
  modelName.value = null
  error.value = null
  requestKey.value++
}

function cancel(): void {
  submitted.value = ''
  requestKey.value++
  status.value = 'idle'
  error.value = null
}

function reset(): void {
  cancel()
  draft.value = ''
  forceDraft.value = false
  submittedForce.value = false
  cached.value = null
  providerStreaming.value = null
  modelName.value = null
}

function onStart(value: TranslationStreamStart): void {
  cached.value = value.cached
  providerStreaming.value = value.streaming
  modelName.value = value.model_name
}

function onDone(value: TranslateResponse): void {
  status.value = 'completed'
  cached.value = value.cached
  modelName.value = value.model_name
}

function onError(value: Error): void {
  status.value = 'failed'
  error.value = value.message
}
</script>

<template>
  <AppPage>
    <div class="space-y-6">
      <section class="space-y-3 rounded-lg border bg-card p-4">
        <label for="translation-test-source" class="text-sm font-medium">Source text</label>
        <Textarea
          id="translation-test-source"
          v-model="draft"
          rows="8"
          class="font-mono text-sm"
          placeholder="Enter English text to translate…"
        />
        <div class="flex flex-wrap items-center gap-3">
          <Button :disabled="!canStart" @click="start">{{ submitted ? 'Run again' : 'Start translation' }}</Button>
          <Button variant="outline" :disabled="!submitted" @click="cancel">Cancel</Button>
          <Button variant="ghost" @click="reset">Reset</Button>
          <label class="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <input v-model="forceDraft" type="checkbox" class="size-4 rounded border-border" />
            Force re-translation
          </label>
        </div>
      </section>

      <section class="space-y-3 rounded-lg border bg-card p-4">
        <div class="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span>Status: <strong class="text-foreground">{{ status }}</strong></span>
          <span>Cached: <strong class="text-foreground">{{ cached ?? '—' }}</strong></span>
          <span>Provider streaming: <strong class="text-foreground">{{ providerStreaming ?? '—' }}</strong></span>
          <span>Model: <strong class="text-foreground">{{ modelName ?? '—' }}</strong></span>
        </div>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

        <div class="min-h-28 rounded-md border bg-muted/30 p-4">
          <p v-if="!submitted" class="text-sm text-muted-foreground">Submit source text to inspect streaming output.</p>
          <StreamingTranslationText
            v-else
            :key="requestKey"
            :text="submitted"
            :force="submittedForce"
            @status="status = $event"
            @start="onStart"
            @done="onDone"
            @error="onError"
            v-slot="{ text, status: liveStatus, cached: liveCached, error: liveError }"
          >
            <p
              class="whitespace-pre-wrap text-base leading-7"
              :class="liveStatus === 'streaming' ? 'text-foreground' : 'text-foreground/90'"
            >{{ text || (liveStatus === 'connecting' ? 'Waiting for the first chunk…' : '') }}</p>
            <p v-if="liveStatus !== 'idle'" class="mt-3 text-xs text-muted-foreground">
              Child state: {{ liveStatus }} · cached: {{ liveCached }}<span v-if="liveError"> · {{ liveError }}</span>
            </p>
          </StreamingTranslationText>
        </div>
      </section>
    </div>
  </AppPage>
</template>
