import { and, eq, inArray, notInArray, or, sql, type SQL, type SQLWrapper } from 'drizzle-orm'
import type { SharingDataType, SharingPreferences, VisibilityScope } from '@paperland/shared'
import { getConfig } from '../config.js'
import { getDatabase, schema } from '../db/index.js'

// Multi-user visibility for OPTIONALLY-SHARED data (highlights, notes, free Q&A, reference links,
// research sessions).
// Always-shared data (papers, preset Q&A, translations) and always-private data
// (tags, images list, tokens, reading prefs) never go through this module.
//
// Rules (see openspec `data-sharing-preferences`):
//   mine            → owner = viewer
//   all, non-admin  → owner = viewer OR owner shares this type
//   all, admin      → every row
//   anonymous       → nothing (callers add their own public exceptions, e.g. published notes)

export const SHARING_DATA_TYPES: SharingDataType[] = ['highlights', 'notes', 'qa', 'reference_links', 'research']

// Types that stay private until the owner opts in, regardless of `sharing.default_shared`.
const PRIVATE_BY_DEFAULT: SharingDataType[] = ['research']

export interface Viewer {
  id: number
  role: string
}

export function parseScope(raw: unknown): VisibilityScope {
  return raw === 'all' ? 'all' : 'mine'
}

let defaultSharedOverride: boolean | null = null
/** Test hook: force the site default (null restores config lookup). */
export function setDefaultSharedForTesting(value: boolean | null): void {
  defaultSharedOverride = value
}

/** Site default for a switch the user never set. Falls back to `true` when config isn't loaded (tests). */
export function defaultShared(): boolean {
  if (defaultSharedOverride != null) return defaultSharedOverride
  try {
    return getConfig().sharing?.default_shared ?? true
  } catch {
    return true
  }
}

/** Default for one type's switch when the user never set it (research is private by default). */
export function defaultSharedFor(type: SharingDataType): boolean {
  return PRIVATE_BY_DEFAULT.includes(type) ? false : defaultShared()
}

/** Effective switches for one user. */
export function getSharingPrefs(userId: number): SharingPreferences {
  const prefs = Object.fromEntries(SHARING_DATA_TYPES.map((t) => [t, defaultSharedFor(t)])) as SharingPreferences
  const rows = getDatabase().select().from(schema.userSharingSettings)
    .where(eq(schema.userSharingSettings.user_id, userId)).all()
  for (const row of rows) {
    if ((SHARING_DATA_TYPES as string[]).includes(row.data_type)) {
      prefs[row.data_type as SharingDataType] = row.shared === 1
    }
  }
  return prefs
}

/** Upsert a subset of switches for one user. */
export function setSharingPrefs(userId: number, patch: Partial<SharingPreferences>): SharingPreferences {
  const db = getDatabase()
  const now = new Date().toISOString()
  for (const [dataType, shared] of Object.entries(patch)) {
    db.insert(schema.userSharingSettings)
      .values({ user_id: userId, data_type: dataType, shared: shared ? 1 : 0, updated_at: now })
      .onConflictDoUpdate({
        target: [schema.userSharingSettings.user_id, schema.userSharingSettings.data_type],
        set: { shared: shared ? 1 : 0, updated_at: now },
      })
      .run()
  }
  return getSharingPrefs(userId)
}

/** Users whose switch for `type` differs from the site default (explicit rows only). */
function usersWithExplicit(type: SharingDataType, shared: boolean) {
  return getDatabase().select({ user_id: schema.userSharingSettings.user_id })
    .from(schema.userSharingSettings)
    .where(and(
      eq(schema.userSharingSettings.data_type, type),
      eq(schema.userSharingSettings.shared, shared ? 1 : 0),
    ))
}

/** SQL condition: the owner column belongs to a user who shares `type`. */
export function ownerSharesCondition(type: SharingDataType, ownerColumn: SQLWrapper): SQL {
  // Default shared → everyone except explicit opt-outs; default private → only explicit opt-ins.
  return defaultSharedFor(type)
    ? notInArray(ownerColumn as any, usersWithExplicit(type, false))
    : inArray(ownerColumn as any, usersWithExplicit(type, true))
}

/**
 * Row filter for an optionally-shared list. Returns `undefined` for "no restriction" (admin all).
 * Anonymous viewers get an always-false condition; callers OR in public exceptions themselves.
 */
export function ownerVisibilityFilter(
  viewer: Viewer | null | undefined,
  type: SharingDataType,
  ownerColumn: SQLWrapper,
  scope: VisibilityScope,
): SQL | undefined {
  if (!viewer) return sql`0`
  if (scope === 'mine') return eq(ownerColumn as any, viewer.id)
  if (viewer.role === 'admin') return undefined
  return or(eq(ownerColumn as any, viewer.id), ownerSharesCondition(type, ownerColumn))
}

/** Batch: for each owner id, whether they share `type`. */
export function sharedFlagsFor(type: SharingDataType, ownerIds: Array<number | null | undefined>): Map<number, boolean> {
  const ids = [...new Set(ownerIds.filter((id): id is number => id != null))]
  const fallback = defaultSharedFor(type)
  const flags = new Map<number, boolean>(ids.map((id) => [id, fallback]))
  if (ids.length === 0) return flags
  const rows = getDatabase().select().from(schema.userSharingSettings)
    .where(and(
      eq(schema.userSharingSettings.data_type, type),
      inArray(schema.userSharingSettings.user_id, ids),
    )).all()
  for (const row of rows) flags.set(row.user_id, row.shared === 1)
  return flags
}

export function isSharedByOwner(ownerId: number | null | undefined, type: SharingDataType): boolean {
  if (ownerId == null) return false
  return sharedFlagsFor(type, [ownerId]).get(ownerId) ?? defaultSharedFor(type)
}

/** Single-row read check for an optionally-shared row (owner, admin, or logged-in + owner shares). */
export function canViewOwnedRow(
  viewer: Viewer | null | undefined,
  ownerId: number | null | undefined,
  type: SharingDataType,
): boolean {
  if (!viewer) return false
  if (viewer.role === 'admin' || ownerId === viewer.id) return true
  return isSharedByOwner(ownerId, type)
}
