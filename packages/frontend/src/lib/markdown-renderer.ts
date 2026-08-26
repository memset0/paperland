import MarkdownIt from 'markdown-it'
import mk from '@traptitech/markdown-it-katex'
import 'katex/dist/katex.min.css'

const markdown = new MarkdownIt({ breaks: true, linkify: true, html: false })
markdown.use(mk, { throwOnError: false })

export function renderMarkdown(source: string): string {
  return markdown.render(source)
}
