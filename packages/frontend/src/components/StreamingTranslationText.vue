<script setup lang="ts">
import { onBeforeUnmount, ref, watch, type Component } from 'vue'
import type {
  TranslateResponse,
  TranslationStreamStart,
  TranslationStreamStatus,
} from '@paperland/shared'
import { translationApi } from '@/api/client'
import { LatestRequest } from '@/lib/latest-request'
import { paintStreamDelta } from '@/lib/progressive-text'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  text: string
  force?: boolean
  as?: string | Component
}>(), {
  force: false,
  as: 'span',
})

const emit = defineEmits<{
  status: [value: TranslationStreamStatus]
  start: [value: TranslationStreamStart]
  delta: [value: string]
  done: [value: TranslateResponse]
  error: [value: Error]
}>()

const translatedText = ref('')
const status = ref<TranslationStreamStatus>('idle')
const cached = ref(false)
const error = ref<string | null>(null)
const requests = new LatestRequest()

function setStatus(value: TranslationStreamStatus) {
  status.value = value
  emit('status', value)
}

async function startRequest(): Promise<void> {
  requests.cancel()
  translatedText.value = ''
  cached.value = false
  error.value = null

  if (!props.text.trim()) {
    setStatus('idle')
    return
  }

  const request = requests.begin()
  setStatus('connecting')
  try {
    await translationApi.stream(props.text, {
      force: props.force,
      signal: request.signal,
      onStart: (value) => {
        if (!requests.isCurrent(request)) return
        cached.value = value.cached
        emit('start', value)
      },
      onDelta: async (delta) => {
        if (!requests.isCurrent(request)) return
        setStatus('streaming')
        emit('delta', delta)
        await paintStreamDelta(delta, {
          isCurrent: () => requests.isCurrent(request),
          append: (fragment) => { translatedText.value += fragment },
        })
      },
    }).then((result) => {
      if (!requests.isCurrent(request)) return
      translatedText.value = result.translated_text || ''
      cached.value = result.cached
      setStatus('completed')
      emit('done', result)
    })
  } catch (reason) {
    if (!requests.isCurrent(request)) return
    const failure = reason instanceof Error ? reason : new Error(String(reason))
    error.value = failure.message
    setStatus('failed')
    emit('error', failure)
  } finally {
    requests.complete(request)
  }
}

watch([() => props.text, () => props.force], startRequest, { immediate: true })

onBeforeUnmount(() => {
  requests.cancel()
})

defineExpose({ translatedText, status, cached, error })
</script>

<template>
  <slot :text="translatedText" :status="status" :cached="cached" :error="error">
    <component
      :is="as"
      v-bind="$attrs"
      :aria-busy="status === 'connecting' || status === 'streaming'"
    >{{ translatedText }}</component>
  </slot>
</template>
