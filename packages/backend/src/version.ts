import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Paperland version: the root package.json `version` (same as the frontend footer), read once at startup. */
export const APP_VERSION: string = (() => {
  try {
    return JSON.parse(readFileSync(resolve(import.meta.dir, '../../../package.json'), 'utf-8')).version ?? 'unknown'
  } catch { return 'unknown' }
})()
