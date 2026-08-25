export interface ProgressiveRevealOptions {
  append: (text: string) => void
  isCurrent: () => boolean
  nextFrame?: () => Promise<void>
}

export function waitForAnimationFrame(): Promise<void> {
  if (typeof requestAnimationFrame === 'function') {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()))
  }
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/** Append one genuine provider delta, then yield a paint opportunity before the next delta. */
export async function paintStreamDelta(
  text: string,
  options: ProgressiveRevealOptions,
): Promise<boolean> {
  if (!text) return true
  if (!options.isCurrent()) return false
  options.append(text)
  // Yield exactly one normal browser frame: no character splitting and no artificial timer.
  await (options.nextFrame ?? waitForAnimationFrame)()
  return options.isCurrent()
}
