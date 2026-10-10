// Formatting shared by the Usage section and the admin Usage leaderboard.

/** 1234 → "1.2K", 3400000 → "3.4M". */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return String(n)
}

/** Estimated USD cost with precision that still shows small amounts. */
export function formatCost(usd: number): string {
  if (usd === 0) return '$0'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

/** Share of input served from the prompt cache, e.g. "83%". */
export function cacheShare(input: number, cached: number): string {
  return input > 0 ? `${Math.round((cached / input) * 100)}%` : '—'
}

export const USAGE_WINDOWS = [
  { label: 'All time', days: undefined },
  { label: 'Last 30 days', days: 30 },
] as const
