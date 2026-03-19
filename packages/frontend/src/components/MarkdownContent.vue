<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import markedKatex from 'marked-katex-extension'
import 'katex/dist/katex.min.css'

const props = defineProps<{ content: string }>()

marked.use(markedKatex({ throwOnError: false, nonStandard: true }))
marked.setOptions({ breaks: true, gfm: true })

/**
 * Convert \(...\) → $...$ and \[...\] → $$...$$ so marked-katex-extension can handle them.
 * Skips content inside backtick code spans and fenced code blocks.
 */
function normalizeDelimiters(text: string): string {
  // Protect code blocks and inline code from replacement
  const placeholders: string[] = []
  let protected_ = text
    // Fenced code blocks
    .replace(/```[\s\S]*?```/g, (m) => {
      placeholders.push(m)
      return `\x00CODE${placeholders.length - 1}\x00`
    })
    // Inline code
    .replace(/`[^`]+`/g, (m) => {
      placeholders.push(m)
      return `\x00CODE${placeholders.length - 1}\x00`
    })

  // Convert \[...\] → $$...$$ (display math)
  protected_ = protected_.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
  // Convert \(...\) → $...$ (inline math)
  protected_ = protected_.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$')

  // Restore code blocks
  protected_ = protected_.replace(/\x00CODE(\d+)\x00/g, (_, i) => placeholders[Number(i)])

  return protected_
}

const html = computed(() => marked.parse(normalizeDelimiters(props.content)) as string)
</script>

<template>
  <div class="markdown-content max-w-none" v-html="html" />
</template>

<style scoped>
.markdown-content :deep(h1) { font-size: 1.25em; font-weight: 700; margin: 1em 0 0.5em; }
.markdown-content :deep(h2) { font-size: 1.125em; font-weight: 600; margin: 0.8em 0 0.4em; }
.markdown-content :deep(h3) { font-size: 1em; font-weight: 600; margin: 0.6em 0 0.3em; }
.markdown-content :deep(p) { margin: 0.4em 0; line-height: 1.7; }
.markdown-content :deep(ul) { margin: 0.4em 0; padding-left: 1.5em; list-style-type: disc; }
.markdown-content :deep(ol) { margin: 0.4em 0; padding-left: 1.5em; list-style-type: decimal; }
.markdown-content :deep(li) { margin: 0.2em 0; line-height: 1.6; }
.markdown-content :deep(code) {
  background: #f3f4f6; border-radius: 0.25rem; padding: 0.15em 0.35em;
  font-size: 0.85em; color: #374151;
}
.markdown-content :deep(pre) {
  background: #1f2937; color: #e5e7eb; border-radius: 0.5rem;
  padding: 0.75em 1em; overflow-x: auto; margin: 0.5em 0;
}
.markdown-content :deep(pre code) {
  background: none; padding: 0; color: inherit; font-size: 0.85em;
}
.markdown-content :deep(blockquote) {
  border-left: 3px solid #d1d5db; padding-left: 0.75em; margin: 0.5em 0;
  color: #6b7280;
}
.markdown-content :deep(table) { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
.markdown-content :deep(th), .markdown-content :deep(td) {
  border: 1px solid #e5e7eb; padding: 0.4em 0.6em; text-align: left; font-size: 0.85em;
}
.markdown-content :deep(th) { background: #f9fafb; font-weight: 600; }
.markdown-content :deep(strong) { font-weight: 600; }
.markdown-content :deep(a) { color: #4f46e5; text-decoration: underline; }
.markdown-content :deep(hr) { border: none; border-top: 1px solid #e5e7eb; margin: 0.75em 0; }
/* KaTeX display math: center and handle overflow */
.markdown-content :deep(.katex-display) {
  text-align: center; margin: 0.5em 0; overflow-x: auto; overflow-y: hidden;
}
.markdown-content :deep(.katex-display > .katex) { text-align: center; }
</style>
