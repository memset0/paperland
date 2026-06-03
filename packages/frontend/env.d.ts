/// <reference types="vite/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// turndown-plugin-gfm ships no type declarations; each export is a Turndown Plugin.
declare module 'turndown-plugin-gfm' {
  import type { Plugin } from 'turndown'
  export const gfm: Plugin
  export const tables: Plugin
  export const strikethrough: Plugin
  export const taskListItems: Plugin
  export const highlightedCodeBlock: Plugin
}

// Monaco's per-language Monarch grammar modules ship no type declarations.
// We import markdown's `conf` (language configuration) + `language` (Monarch
// tokenizer) to extend it with LaTeX math (see lib/monaco.ts).
declare module 'monaco-editor/esm/vs/basic-languages/markdown/markdown' {
  export const conf: unknown
  export const language: { tokenizer: Record<string, unknown[]>; [k: string]: unknown }
}
