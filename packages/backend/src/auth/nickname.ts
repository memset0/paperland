// Nickname = optional, non-unique public display name. Owner attribution shows
// `display_name` (nickname, falling back to the unique login username).

export const NICKNAME_MAX_LENGTH = 32

/** Normalize a nickname from a request body: trimmed, empty → null. Returns an error message when invalid. */
export function normalizeNickname(raw: unknown): { value: string | null } | { error: string } {
  if (raw === null) return { value: null }
  if (typeof raw !== 'string') return { error: 'Nickname must be a string' }
  const value = raw.trim()
  if (value.length > NICKNAME_MAX_LENGTH) return { error: `Nickname must be at most ${NICKNAME_MAX_LENGTH} characters` }
  return { value: value || null }
}

export function displayName(user: { username: string | null; nickname?: string | null } | null | undefined): string | null {
  if (!user) return null
  return user.nickname || user.username
}
