/**
 * Renumber ATX headings (`#`…`######`) so the levels in use become consecutive from 1, keeping
 * their order: a post using `##` and `###` becomes `#` and `##`, and a skipped level closes up
 * (`#`, `###` → `#`, `##`). Fenced code blocks are left alone. Setext headings are not touched.
 */
export function renumberHeadings(md: string): string {
  const lines = md.split('\n')
  const isHeading: (number | null)[] = []
  let fence: string | null = null
  for (const line of lines) {
    const f = line.match(/^ {0,3}(`{3,}|~{3,})/)
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && !line.trim().slice(f[1].length).trim()) fence = null
      isHeading.push(null)
      continue
    }
    if (f) { fence = f[1]; isHeading.push(null); continue }
    const h = line.match(/^ {0,3}(#{1,6})(?=[ \t]|$)/)
    isHeading.push(h ? h[1].length : null)
  }
  const used = [...new Set(isHeading.filter((l): l is number => l != null))].sort((a, b) => a - b)
  const rank = new Map(used.map((level, i) => [level, i + 1]))
  if (used.every((level, i) => level === i + 1)) return md
  return lines.map((line, i) => {
    const level = isHeading[i]
    return level == null ? line : line.replace(/^( {0,3})#{1,6}/, (_, indent) => indent + '#'.repeat(rank.get(level)!))
  }).join('\n')
}
