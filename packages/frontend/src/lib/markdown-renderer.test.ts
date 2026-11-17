import { describe, expect, it } from 'bun:test'
import { isVideoUrl, renderMarkdown } from './markdown-renderer'

describe('video embeds', () => {
  it('renders image syntax for mp4/webm as a video', () => {
    const html = renderMarkdown('![Clip "one" w=md](/image/2026/10/16/abc123.mp4)')
    expect(html).toContain('<video src="/image/2026/10/16/abc123.mp4" controls preload="metadata" playsinline')
    expect(html).toContain('data-alt="Clip &quot;one&quot; w=md"')
    expect(html).not.toContain('<img')
  })

  it('keeps images and ignores query/fragment when detecting videos', () => {
    expect(renderMarkdown('![Fig](/image/a.png)')).toContain('<img src="/image/a.png" alt="Fig">')
    expect(isVideoUrl('/x/clip.WEBM?v=2#t=3')).toBe(true)
    expect(isVideoUrl('/x/clip.mp4.png')).toBe(false)
  })

  it('still escapes raw HTML', () => {
    expect(renderMarkdown('<video src="x.mp4" onerror="alert(1)">')).not.toContain('<video')
  })
})

describe('Topic HTML', () => {
  // Offline DOM for DOMPurify (bun test has no window).
  const { JSDOM } = require('jsdom')
  const { createTopicSanitizer } = require('./markdown-renderer')
  const purifier = createTopicSanitizer(new JSDOM('').window as any)
  const topic = (s: string) => renderMarkdown(s, { html: true, purifier })

  it('keeps inline styled spans', () => {
    const html = topic('A <span style="background:#fef08a">key idea</span> here')
    expect(html).toContain('<span style="background:#fef08a">key idea</span>')
  })

  it('removes scripts, handlers, javascript: URLs and fixed positioning', () => {
    const html = topic([
      '<script>alert(1)</script>',
      '',
      'x <img src="a.png" onerror="alert(2)"> <a href="javascript:alert(3)">l</a>',
      '',
      '<div style="position: fixed; inset: 0">cover</div>',
      '',
      '<style>body{display:none}</style><iframe src="https://e.com"></iframe>',
    ].join('\n'))
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('javascript:')
    expect(html).not.toMatch(/position\s*:\s*fixed/)
    expect(html).toContain('cover')
    expect(html).not.toContain('<style')
    expect(html).not.toContain('<iframe')
  })

  it('keeps KaTeX, videos and data attributes', () => {
    expect(topic('$x^2$')).toContain('katex')
    const video = topic('![Clip w=md](/image/a.mp4)')
    expect(video).toContain('<video')
    expect(video).toContain('playsinline')
    expect(video).toContain('data-alt="Clip w=md"')
  })

  it('leaves the default renderer with HTML disabled', () => {
    expect(renderMarkdown('<span style="color:red">x</span>')).toContain('&lt;span')
  })
})
