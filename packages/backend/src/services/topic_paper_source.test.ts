import { describe, expect, test } from 'bun:test'
import { topicArxivId } from './topic_paper_source'

describe('Topic arXiv-paper source recognition (offline)', () => {
  test.each([
    ['https://arxiv.org/abs/2501.01234v2', '2501.01234'],
    ['https://arxiv.org/pdf/1706.03762v7.pdf', '1706.03762'],
    ['https://arxiv.org/html/2610.23479v3#S3', '2610.23479'],
    ['http://export.arxiv.org/abs/hep-th/9901001v1', 'hep-th/9901001'],
  ])('normalizes %s without fetching', (url, id) => { expect(topicArxivId(url)).toBe(id) })
  test.each([undefined, 'https://example.test/project', 'https://arxiv.org.evil.test/abs/2501.01234', 'https://user:secret@arxiv.org/abs/2501.01234', 'https://arxiv.org:9000/abs/2501.01234', 'file:///abs/2501.01234', 'https://arxiv.org/list/cs.AI', 'https://arxiv.org/abs/../../etc/passwd', 'https://arxiv.org/abs/not-a-paper'])('does not classify %s as an importable paper', (url) => { expect(topicArxivId(url)).toBeNull() })
})
