import { describe, expect, it } from 'bun:test'
import { renumberHeadings } from './markdown_headings.js'

describe('renumberHeadings', () => {
  it('shifts the top level to 1 and closes gaps', () => {
    expect(renumberHeadings('## A\ntext\n### B\n## C')).toBe('# A\ntext\n## B\n# C')
    expect(renumberHeadings('# A\n### B\n###### C')).toBe('# A\n## B\n### C')
  })
  it('leaves already-consecutive headings, code fences and non-headings alone', () => {
    expect(renumberHeadings('# A\n## B')).toBe('# A\n## B')
    const md = '## A\n```bash\n## not a heading\n```\n#hashtag\n  ### B'
    expect(renumberHeadings(md)).toBe('# A\n```bash\n## not a heading\n```\n#hashtag\n  ## B')
    expect(renumberHeadings('no headings')).toBe('no headings')
  })
})
