import MarkdownIt from 'markdown-it'
import mk from '@traptitech/markdown-it-katex'
import DOMPurify, { type DOMPurify as Purifier, type WindowLike } from 'dompurify'
import 'katex/dist/katex.min.css'

/** Image syntax pointing at a video file (`![alt](clip.mp4)`) — works without raw HTML. */
export function isVideoUrl(src: string): boolean {
  return /\.(mp4|webm)$/i.test(src.split(/[?#]/)[0])
}

function createRenderer(html: boolean): MarkdownIt {
  const md = new MarkdownIt({ breaks: true, linkify: true, html })
  md.use(mk, { throwOnError: false })
  const defaultImage = md.renderer.rules.image!
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const src = token.attrGet('src') || ''
    if (!isVideoUrl(src)) return defaultImage(tokens, idx, options, env, self)
    const alt = self.renderInlineAsText(token.children || [], options, env)
    const esc = md.utils.escapeHtml
    // `data-alt` carries the alt text so MarkdownContent can apply the `w=` width directive.
    return `<video src="${esc(src)}" controls preload="metadata" playsinline aria-label="${esc(alt)}" data-alt="${esc(alt)}"></video>`
  }
  return md
}

// Default: raw HTML disabled (Q&A answers, notes, paper text). Topics opt in to sanitized HTML.
const markdown = createRenderer(false)
const htmlMarkdown = createRenderer(true)

const PURIFY_CONFIG = {
  FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select'],
  ADD_ATTR: ['playsinline'],
}
const pinned = /position\s*:\s*(fixed|sticky)/i

/** A DOMPurify instance with the Topic HTML policy (fixed/sticky positioning is dropped). */
export function createTopicSanitizer(window?: WindowLike): Purifier {
  const purifier = window ? DOMPurify(window) : DOMPurify
  purifier.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName === 'style' && pinned.test(data.attrValue)) data.keepAttr = false
  })
  return purifier
}
let sanitizer: Purifier | null = null

export function sanitizeTopicHtml(html: string, purifier?: Purifier): string {
  const p = purifier ?? (sanitizer ??= createTopicSanitizer())
  return p.sanitize(html, PURIFY_CONFIG) as string
}

export function renderMarkdown(source: string, options: { html?: boolean; purifier?: Purifier } = {}): string {
  if (!options.html) return markdown.render(source)
  return sanitizeTopicHtml(htmlMarkdown.render(source), options.purifier)
}
