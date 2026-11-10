<script setup lang="ts">
withDefaults(defineProps<{ title?: string | null; authors?: string[]; year?: number | null; venue?: string | null }>(), { authors: () => [] })
</script>

<template>
  <div class="paper-citation-card">
    <div class="qa-cite-card-title"><slot name="title">{{ title || 'Untitled' }}</slot></div>
    <div v-if="authors.length || year || venue" class="qa-cite-card-meta">
      <span v-if="authors.length">{{ authors.slice(0, 3).join(', ') }}<template v-if="authors.length > 3"> et al.</template></span>
      <span v-if="year"><template v-if="authors.length"> · </template>{{ year }}</span>
      <span v-if="venue"><template v-if="authors.length || year"> · </template>{{ venue }}</span>
    </div>
    <slot />
    <div class="qa-cite-card-actions"><slot name="actions" /></div>
  </div>
</template>

<style scoped>
.qa-cite-card-title { font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
.qa-cite-card-meta { margin-top: 0.2rem; color: var(--muted-foreground); overflow-wrap: anywhere; }
.qa-cite-card-actions { margin-top: 0.45rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; }
.qa-cite-card-actions :deep(a), .qa-cite-card-actions :deep(button) { display: inline-flex; align-items: center; gap: 0.25rem; color: var(--primary); text-decoration: none; }
</style>
