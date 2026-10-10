<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AlertCircle, CheckCircle2, Languages, Loader2, RotateCcw } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import PdfViewer from '@/components/PdfViewer.vue'
import { useDoc2xStore } from '@/stores/doc2x'
import { useAuthStore } from '@/stores/auth'
import { useLoginPrompt } from '@/composables/useLoginPrompt'

type Display = 'bilingual' | 'translated'
const DISPLAY_KEY = 'paperland.doc2x.view'

const doc2x = useDoc2xStore()
const auth = useAuthStore()
const { openLogin } = useLoginPrompt()

function readDisplay(): Display {
  try {
    return localStorage.getItem(DISPLAY_KEY) === 'translated' ? 'translated' : 'bilingual'
  } catch {
    return 'bilingual'
  }
}
const display = ref<Display>(readDisplay())
watch(display, (v) => {
  try { localStorage.setItem(DISPLAY_KEY, v) } catch {}
})

const status = computed(() => doc2x.status)
const parse = computed(() => status.value?.parse)
const translate = computed(() => status.value?.translate)
const pdfPath = computed(() => {
  const t = translate.value
  if (!t || t.status !== 'done') return null
  return display.value === 'translated' ? t.translated_pdf_path : t.bilingual_pdf_path
})

const parseLabel = computed(() => {
  switch (parse.value?.status) {
    case 'done': return 'doc2x parse: done'
    case 'running': return 'doc2x parse: running…'
    case 'pending': return 'doc2x parse: queued…'
    case 'failed': return 'doc2x parse: failed'
    default: return 'doc2x parse: not started'
  }
})

function requireLogin(): boolean {
  if (auth.isAuthenticated) return true
  openLogin()
  return false
}
function startTranslate() {
  if (requireLogin()) doc2x.request('translate')
}
function startParse() {
  if (requireLogin()) doc2x.request('parse')
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Status / display toolbar -->
    <div class="flex items-center gap-2 px-3 h-9 border-b bg-background shrink-0 text-xs">
      <span class="flex items-center gap-1 text-muted-foreground min-w-0" :title="parse?.error || undefined">
        <CheckCircle2 v-if="parse?.status === 'done'" class="h-3.5 w-3.5 text-primary shrink-0" />
        <Loader2 v-else-if="parse?.status === 'running' || parse?.status === 'pending'" class="h-3.5 w-3.5 animate-spin shrink-0" />
        <AlertCircle v-else-if="parse?.status === 'failed'" class="h-3.5 w-3.5 text-destructive shrink-0" />
        <span class="truncate">{{ parseLabel }}</span>
      </span>
      <Button
        v-if="parse && (parse.status === 'none' || parse.status === 'failed') && translate?.status !== 'queued'"
        variant="link" size="xs" class="h-auto p-0" :disabled="doc2x.requesting" @click="startParse"
      >
        {{ parse.status === 'failed' ? 'Re-parse' : 'Start parse' }}
      </Button>
      <div v-if="translate?.status === 'done'" class="ml-auto flex rounded-md border p-0.5">
        <button
          v-for="opt in ([['bilingual', 'Side by side'], ['translated', 'Translation only']] as const)" :key="opt[0]"
          class="px-2 py-0.5 rounded-sm transition-colors"
          :class="display === opt[0] ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
          @click="display = opt[0]"
        >
          {{ opt[1] }}
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-hidden">
      <PdfViewer v-if="pdfPath" :key="pdfPath" :pdf-path="pdfPath" :paper-id="null" />

      <div v-else class="h-full flex flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
        <Loader2 v-if="!status" class="h-6 w-6 animate-spin" />

        <template v-else-if="translate?.status === 'idle'">
          <Languages class="h-10 w-10 stroke-1" />
          <p class="text-sm">Use doc2x to create a bilingual PDF that keeps the layout (references are not translated).</p>
          <Button size="sm" :disabled="doc2x.requesting" @click="startTranslate">
            <Languages />Start translation
          </Button>
        </template>

        <template v-else-if="translate?.status === 'queued'">
          <Loader2 class="h-6 w-6 animate-spin" />
          <p v-if="parse?.status === 'failed'" class="text-sm">
            Translation was waiting for the doc2x parse, but the parse failed: <span class="text-destructive">{{ parse.error }}</span>
          </p>
          <p v-else class="text-sm">Queued; translation starts after the doc2x parse finishes…</p>
          <Button v-if="parse?.status === 'failed'" size="sm" variant="outline" :disabled="doc2x.requesting" @click="startTranslate">
            <RotateCcw />Re-parse and translate
          </Button>
        </template>

        <template v-else-if="translate?.status === 'pending' || translate?.status === 'running'">
          <Loader2 class="h-6 w-6 animate-spin" />
          <p class="text-sm">{{ translate.status === 'pending' ? 'Translation queued…' : 'Translating, usually 1–3 minutes…' }}</p>
        </template>

        <template v-else-if="translate?.status === 'failed'">
          <AlertCircle class="h-8 w-8 text-destructive stroke-1" />
          <p class="text-sm break-all">Translation failed: {{ translate.error }}</p>
          <Button size="sm" variant="outline" :disabled="doc2x.requesting" @click="startTranslate">
            <RotateCcw />Retry
          </Button>
        </template>
      </div>
    </div>
  </div>
</template>
