import { createHash } from 'crypto'

/** Same fingerprint used by MarkdownContent: MD5 after removing every whitespace character. */
export function markdownContentHash(content: string): string {
  return createHash('md5').update(content.replace(/\s/g, '')).digest('hex')
}
