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
