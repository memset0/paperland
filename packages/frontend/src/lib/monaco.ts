// Lazy bootstrap for the Monaco editor (mirrors lib/pdfjs.ts).
//
// Monaco is multi-MB, so it is loaded via a dynamic `import()` and code-split out
// of the main bundle — only fetched when a note editor mounts. We import the
// minimal ESM surface: the editor API plus Monaco's Markdown Monarch grammar,
// which we extend with LaTeX math rules before registering (no JSON/TS/etc.
// tokenizers). Markdown needs no language-service worker, only the base editor
// worker, which Vite emits as a separate asset and we register on
// `self.MonacoEnvironment`.
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

type Monaco = typeof import('monaco-editor/esm/vs/editor/editor.api')

let monacoPromise: Promise<Monaco> | null = null

/** Theme ids registered by `defineThemes`. */
const LIGHT_THEME = 'paperland-light'
const DARK_THEME = 'paperland-dark'

/**
 * Extend Monaco's built-in Markdown Monarch grammar for paperland notes. Rules
 * are prepended to the `linecontent` state (reached both at line start and
 * mid-line via root's `@linecontent` include) so they win over the originals; the
 * rest of the grammar is the unchanged original. Adds:
 *
 * - **LaTeX math**: `$…$` (inline) and `$$…$$` (block) — the KaTeX delimiters the
 *   app renders — are highlighted instead of shown as plain text; block math is a
 *   stateful region that also tokenizes `\commands` and braces.
 * - **Image-in-link anchors** `[![alt](imgUrl)](linkUrl)` (paperland's PDF-region
 *   / image-host anchors): Monaco's built-in link rule stops at the inner image's
 *   `]`, so the outer `[` is link-colored but the trailing `](…)` is not — the
 *   brackets visibly mismatch. This rule matches the whole shape and colors all
 *   its delimiters + both URLs as link (alt text stays default).
 */
function extendMarkdown(base: { tokenizer: Record<string, unknown[]>; [k: string]: unknown }) {
  const mathInner = [
    [/\\[a-zA-Z@]+/, 'type.identifier.math'], // \frac, \alpha, …
    [/[{}[\]]/, 'delimiter.bracket.math'],
    [/[\^_&~]/, 'keyword.operator.math'],
    [/[^\\${}[\]^_&~]+/, 'string.math'],
    [/./, 'string.math'],
  ]
  return {
    ...base,
    tokenizer: {
      ...base.tokenizer,
      linecontent: [
        // image-in-link: [![alt](imgUrl)](linkUrl) — color every delimiter + both
        // URLs as link so the brackets match; alt text stays default.
        [
          /(\[!\[)([^\]]*)(\]\()([^)]*)(\)\]\()([^)]*)(\))/,
          ['string.link', '', 'string.link', 'string.link', 'string.link', 'string.link', 'string.link'],
        ],
        // block math $$ … $$ (may span lines)
        [/\$\$/, { token: 'keyword.math', next: '@latexBlock' }],
        // inline math $ … $ on one line (no space just inside the delimiters,
        // so prose prices like "$5 and $10" are not mistaken for math)
        [/\$(?=[^\s$])(?:\\.|[^$\n])*?[^\s$]\$/, 'string.math'],
        ...base.tokenizer.linecontent,
      ],
      latexBlock: [[/\$\$/, { token: 'keyword.math', next: '@pop' }], ...mathInner],
    },
  }
}

/** Register Markdown (with the math-extended grammar) and its language config. */
function registerMarkdown(monaco: Monaco, conf: unknown, language: unknown) {
  if (!monaco.languages.getLanguages().some((l) => l.id === 'markdown')) {
    monaco.languages.register({ id: 'markdown', extensions: ['.md', '.markdown'], aliases: ['Markdown', 'markdown'] })
  }
  monaco.languages.setLanguageConfiguration('markdown', conf as Parameters<typeof monaco.languages.setLanguageConfiguration>[1])
  monaco.languages.setMonarchTokensProvider(
    'markdown',
    extendMarkdown(language as Parameters<typeof extendMarkdown>[0]) as unknown as Parameters<typeof monaco.languages.setMonarchTokensProvider>[1],
  )
}

/**
 * Light / dark editor themes whose background is transparent so the editor blends
 * into the surrounding note panel (like the `bg-transparent` textarea it replaces).
 * Base token colors inherit from `vs` / `vs-dark`; the `*.math` rules color the
 * LaTeX added by `withMath` (delimiters / commands / content distinctly).
 */
function defineThemes(monaco: Monaco) {
  monaco.editor.defineTheme(LIGHT_THEME, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword.math', foreground: 'c2410c', fontStyle: 'bold' },
      { token: 'delimiter.bracket.math', foreground: 'c2410c' },
      { token: 'keyword.operator.math', foreground: 'be185d' },
      { token: 'type.identifier.math', foreground: '7c3aed' },
      { token: 'string.math', foreground: '0f766e' },
    ],
    colors: { 'editor.background': '#00000000' },
  })
  monaco.editor.defineTheme(DARK_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword.math', foreground: 'fbbf24', fontStyle: 'bold' },
      { token: 'delimiter.bracket.math', foreground: 'fbbf24' },
      { token: 'keyword.operator.math', foreground: 'f9a8d4' },
      { token: 'type.identifier.math', foreground: 'c4b5fd' },
      { token: 'string.math', foreground: '5eead4' },
    ],
    colors: { 'editor.background': '#00000000' },
  })
}

/** Map the app's resolved theme to the matching Monaco theme id. */
export function monacoThemeFor(resolved: 'light' | 'dark'): string {
  return resolved === 'dark' ? DARK_THEME : LIGHT_THEME
}

/** Load Monaco once, register its worker, the (math-extended) Markdown language, and our themes. */
export function loadMonaco(): Promise<Monaco> {
  if (!monacoPromise) {
    // The worker env must be set before any editor is created. Markdown has no
    // dedicated language-service worker, so the base editor worker serves all labels.
    ;(self as unknown as { MonacoEnvironment: { getWorker: () => Worker } }).MonacoEnvironment = {
      getWorker: () => new EditorWorker(),
    }
    monacoPromise = (async () => {
      const monaco = await import('monaco-editor/esm/vs/editor/editor.api')
      // Monaco's Markdown Monarch grammar (conf + language), extended with math.
      const md = await import('monaco-editor/esm/vs/basic-languages/markdown/markdown')
      registerMarkdown(monaco, md.conf, md.language)
      defineThemes(monaco)
      return monaco
    })()
  }
  return monacoPromise
}
