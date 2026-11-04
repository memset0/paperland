import MarkdownIt from 'markdown-it'
import mk from '@traptitech/markdown-it-katex'
import 'katex/dist/katex.min.css'

const markdown = new MarkdownIt({ breaks: true, linkify: true, html: false })
markdown.use(mk, { throwOnError: false })

/** Image syntax pointing at a video file (`![alt](clip.mp4)`) — raw HTML stays disabled. */
export function isVideoUrl(src: string): boolean {
  return /\.(mp4|webm)$/i.test(src.split(/[?#]/)[0])
}

const defaultImage = markdown.renderer.rules.image!
markdown.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const src = token.attrGet('src') || ''
  if (!isVideoUrl(src)) return defaultImage(tokens, idx, options, env, self)
  const alt = self.renderInlineAsText(token.children || [], options, env)
  const esc = markdown.utils.escapeHtml
  // `data-alt` carries the alt text so MarkdownContent can apply the `w=` width directive.
  return `<video src="${esc(src)}" controls preload="metadata" playsinline aria-label="${esc(alt)}" data-alt="${esc(alt)}"></video>`
}

export function renderMarkdown(source: string): string {
  return markdown.render(source)
}
