import { and, desc, eq, gte, lt, sql, type SQL } from 'drizzle-orm'
import type { ModelPricing, MyUsage, UsageCategory, UsageLeaderboardEntry, UsageTotals } from '@paperland/shared'
import { getConfig } from '../config.js'
import { getDatabase, schema } from '../db/index.js'
import type { ModelUsage } from './model_providers/types.js'

// Ledger of model token usage and estimated cost (`model_usage`). Callers report one row per model
// invocation with the category that caused it, the matching source id, and the user it is billed to.

export const USAGE_CATEGORIES: UsageCategory[] = ['qa', 'research', 'translation']

const SOURCE_COLUMN = {
  qa: 'qa_result_id',
  research: 'research_step_id',
  translation: 'translation_id',
} as const

/** Estimated USD cost; reasoning is part of output. Null without pricing. */
export function estimateCost(usage: ModelUsage, pricing: ModelPricing | undefined): number | null {
  if (!pricing) return null
  const cached = Math.min(usage.cached_input_tokens, usage.input_tokens)
  const uncached = usage.input_tokens - cached
  const cachedRate = pricing.cached_input ?? pricing.input
  return (uncached * pricing.input + cached * cachedRate + usage.output_tokens * pricing.output) / 1_000_000
}

export interface RecordUsageInput {
  category: UsageCategory
  userId: number | null | undefined
  sourceId: number | null | undefined
  modelName: string
  usage: ModelUsage
}

/** Insert one usage row. Never throws: usage accounting must not fail a model run. */
export function recordModelUsage(input: RecordUsageInput): void {
  try {
    const pricing = getConfig().models.available.find((m) => m.name === input.modelName)?.pricing
    getDatabase().insert(schema.modelUsage).values({
      category: input.category,
      user_id: input.userId ?? null,
      [SOURCE_COLUMN[input.category]]: input.sourceId ?? null,
      model_name: input.modelName,
      input_tokens: input.usage.input_tokens,
      cached_input_tokens: input.usage.cached_input_tokens,
      output_tokens: input.usage.output_tokens,
      reasoning_tokens: input.usage.reasoning_tokens,
      total_tokens: input.usage.total_tokens,
      cost_usd: estimateCost(input.usage, pricing),
      created_at: new Date().toISOString(),
    }).run()
  } catch (error) {
    console.warn(`[usage] failed to record ${input.category} usage for ${input.modelName}:`, error)
  }
}

// ---- aggregation ----

const totalsSelect = {
  calls: sql<number>`count(*)`,
  input_tokens: sql<number>`coalesce(sum(${schema.modelUsage.input_tokens}), 0)`,
  cached_input_tokens: sql<number>`coalesce(sum(${schema.modelUsage.cached_input_tokens}), 0)`,
  output_tokens: sql<number>`coalesce(sum(${schema.modelUsage.output_tokens}), 0)`,
  total_tokens: sql<number>`coalesce(sum(${schema.modelUsage.total_tokens}), 0)`,
  cost_usd: sql<number>`coalesce(sum(${schema.modelUsage.cost_usd}), 0)`,
}

function sinceFilter(days: number | undefined): SQL | undefined {
  if (!days) return undefined
  return gte(schema.modelUsage.created_at, new Date(Date.now() - days * 86_400_000).toISOString())
}

/** One user's totals, overall and per category. */
export function userUsage(userId: number, days?: number): MyUsage {
  const db = getDatabase()
  const where = and(eq(schema.modelUsage.user_id, userId), sinceFilter(days))
  const rows = db.select({ category: schema.modelUsage.category, ...totalsSelect })
    .from(schema.modelUsage).where(where).groupBy(schema.modelUsage.category).all()
  const empty = (): UsageTotals => ({ calls: 0, input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_usd: 0 })
  const byCategory = Object.fromEntries(USAGE_CATEGORIES.map((c) => [c, empty()])) as Record<UsageCategory, UsageTotals>
  const total = empty()
  for (const { category, ...t } of rows) {
    if (category in byCategory) byCategory[category as UsageCategory] = t
    for (const key of Object.keys(total) as (keyof UsageTotals)[]) total[key] += t[key]
  }
  return { total, by_category: byCategory }
}

/** Per-user totals, most expensive first (then most tokens). Usage without a user is one entry. */
export function usageLeaderboard(days?: number): UsageLeaderboardEntry[] {
  const db = getDatabase()
  const cost = totalsSelect.cost_usd
  const tokens = totalsSelect.total_tokens
  return db.select({
    user_id: schema.modelUsage.user_id,
    username: schema.users.username,
    nickname: schema.users.nickname,
    ...totalsSelect,
  })
    .from(schema.modelUsage)
    .leftJoin(schema.users, eq(schema.users.id, schema.modelUsage.user_id))
    .where(sinceFilter(days))
    .groupBy(schema.modelUsage.user_id)
    .orderBy(desc(cost), desc(tokens))
    .all()
}

// ---- recalculation ----

export interface RecalculateRange {
  /** Inclusive UTC day `YYYY-MM-DD`; omitted = open. */
  from?: string
  to?: string
}

export interface RecalculateResult {
  updated: number
  skipped: number
  skipped_models: string[]
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Parse a `YYYY-MM-DD` day to its UTC start, or null when it is not a real date. */
export function parseUtcDay(day: string): Date | null {
  if (!DAY_RE.test(day)) return null
  const date = new Date(`${day}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day ? null : date
}

/**
 * Recompute `cost_usd` from stored tokens and the current `pricing` of each row's model, for rows
 * created in the inclusive UTC day range. Rows whose model is unconfigured or unpriced keep their cost.
 */
export function recalculateCosts(range: RecalculateRange = {}): RecalculateResult {
  const db = getDatabase()
  const u = schema.modelUsage
  const conditions: SQL[] = []
  if (range.from) conditions.push(gte(u.created_at, parseUtcDay(range.from)!.toISOString()))
  if (range.to) conditions.push(lt(u.created_at, new Date(parseUtcDay(range.to)!.getTime() + 86_400_000).toISOString()))
  const inRange = conditions.length ? and(...conditions) : undefined
  const pricing = new Map(getConfig().models.available.filter((m) => m.pricing).map((m) => [m.name, m.pricing!]))

  const counts = db.select({ model_name: u.model_name, n: sql<number>`count(*)` })
    .from(u).where(inRange).groupBy(u.model_name).all()
  const result: RecalculateResult = { updated: 0, skipped: 0, skipped_models: [] }
  db.transaction((tx) => {
    for (const { model_name, n } of counts) {
      const p = pricing.get(model_name)
      if (!p) {
        result.skipped += n
        result.skipped_models.push(model_name)
        continue
      }
      // Same formula as estimateCost: cached input clamped to input, cached price defaults to input.
      const cached = sql`min(${u.cached_input_tokens}, ${u.input_tokens})`
      tx.update(u)
        .set({ cost_usd: sql`((${u.input_tokens} - ${cached}) * ${p.input} + ${cached} * ${p.cached_input ?? p.input} + ${u.output_tokens} * ${p.output}) / 1000000.0` })
        .where(and(eq(u.model_name, model_name), inRange))
        .run()
      result.updated += n
    }
  })
  result.skipped_models.sort()
  return result
}
