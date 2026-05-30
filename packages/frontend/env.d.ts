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
