<script setup lang="ts">
// Build identity footer: `Paperland v<version> · <hash>` (values injected by vite.config.ts).
const version = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown'
const hash = typeof __GIT_HASH__ === 'string' ? __GIT_HASH__ : 'unknown'
const commitUrl = hash === 'unknown' ? null : `https://github.com/mem-research/paperland/commit/${hash}`
</script>

<template>
  <div class="text-[11px] text-muted-foreground/70">
    Paperland v{{ version }} ·
    <a v-if="commitUrl" :href="commitUrl" target="_blank" rel="noopener noreferrer" class="font-mono hover:text-foreground hover:underline">{{ hash }}</a>
    <span v-else class="font-mono">{{ hash }}</span>
  </div>
</template>
