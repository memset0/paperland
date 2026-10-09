import { describe, expect, test } from 'bun:test'
import { selectBackupsToDelete } from './backup.js'

const DAY_MS = 24 * 60 * 60 * 1000

function dateAgo(today: string, days: number): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) - days * DAY_MS).toISOString().split('T')[0]
}

function namesAged(today: string, ages: number[]): string[] {
  return ages.map((a) => `paperland_${dateAgo(today, a)}.db`)
}

const TODAY = '2026-10-09'

describe('selectBackupsToDelete', () => {
  test('keeps every backup aged 0..7', () => {
    expect(selectBackupsToDelete(namesAged(TODAY, [0, 1, 2, 3, 4, 5, 6, 7]), TODAY, 7, [14, 28])).toEqual([])
  })

  test('keeps only the oldest backup per checkpoint interval', () => {
    const files = namesAged(TODAY, [9, 12, 14])
    expect(selectBackupsToDelete(files, TODAY, 7, [14, 28]).sort()).toEqual(namesAged(TODAY, [9, 12]).sort())
  })

  test('deletes backups older than the last checkpoint', () => {
    expect(selectBackupsToDelete(namesAged(TODAY, [28, 29, 40]), TODAY, 7, [14, 28]).sort())
      .toEqual(namesAged(TODAY, [29, 40]).sort())
  })

  test('ignores manual and unrelated files', () => {
    const files = ['pre-notes-root_20260529_224753.db', 'pre-notes-root_20260529_224753.db-wal', '.gitkeep', 'paperland_bogus.db']
    expect(selectBackupsToDelete(files, TODAY, 7, [14, 28])).toEqual([])
  })

  test('checkpoints at or below the daily window are ignored', () => {
    expect(selectBackupsToDelete(namesAged(TODAY, [7, 8, 10]), TODAY, 7, [7, 14, 14]))
      .toEqual(namesAged(TODAY, [8]))
  })

  test('60 days of daily runs settle into 8 daily + one per checkpoint interval', () => {
    let files: string[] = []
    const start = '2026-01-01'
    for (let day = 0; day < 60; day++) {
      const today = dateAgo(start, -day)
      files.push(`paperland_${today}.db`)
      const doomed = new Set(selectBackupsToDelete(files, today, 7, [14, 28]))
      files = files.filter((f) => !doomed.has(f))

      const ages = files.map((f) => Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${f.slice(10, 20)}T00:00:00Z`)) / DAY_MS))
      expect(ages.every((a) => a <= 28)).toBe(true)
      expect(ages.filter((a) => a <= 7).length).toBe(Math.min(day + 1, 8))
      if (day >= 8) expect(ages.filter((a) => a >= 8 && a <= 14).length).toBe(1)
      if (day >= 15) expect(ages.filter((a) => a >= 15 && a <= 28).length).toBe(1)
    }
    expect(files.length).toBe(10)
  })
})
