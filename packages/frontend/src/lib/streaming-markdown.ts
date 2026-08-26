export interface StreamingMarkdownSplit {
  stable: string
  tail: string
}

function unsafeIndependentBlock(block: string): boolean {
  const lines = block.split('\n')
  return lines.some((line) => /^\s*(?:[-+*]|\d+\.)\s+/.test(line))
    || lines.some((line) => /^\s*>/.test(line))
    || lines.some((line) => line.includes('|'))
}

/**
 * Find a conservative Markdown prefix whose block structure cannot be changed by
 * later text. Lists, blockquotes, and tables intentionally remain provisional.
 */
export function splitStreamingMarkdown(source: string): StreamingMarkdownSplit {
  let fence: '`' | '~' | null = null
  let displayMath = false
  let lastSafe = 0
  let blockStart = 0
  let offset = 0
  const lines = source.match(/.*(?:\n|$)/g)?.filter(Boolean) ?? []

  for (const lineWithEnding of lines) {
    const line = lineWithEnding.endsWith('\n') ? lineWithEnding.slice(0, -1) : lineWithEnding
    const trimmed = line.trim()
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1][0] as '`' | '~'
      if (fence === marker) fence = null
      else if (!fence) fence = marker
    } else if (!fence) {
      const mathMarkers = line.match(/\$\$/g)?.length ?? 0
      if (mathMarkers % 2 === 1) displayMath = !displayMath
    }

    offset += lineWithEnding.length
    if (!fence && !displayMath && trimmed === '') {
      const block = source.slice(blockStart, offset)
      if (!unsafeIndependentBlock(block)) {
        lastSafe = offset
        blockStart = offset
      }
    }
  }

  return { stable: source.slice(0, lastSafe), tail: source.slice(lastSafe) }
}
