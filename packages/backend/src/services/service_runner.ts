import { eq, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { getConfig } from '../config.js'
import { Semaphore } from './semaphore.js'
import { RateLimiter } from './rate_limiter.js'
import type { PaperBoundServiceDef, PureServiceDef, ServiceDef } from './base_service.js'

export interface PureServiceExecutionContext {
  executionId: number
  signal: AbortSignal
}

export interface PureServiceExecutionOptions {
  onCreated?: (context: PureServiceExecutionContext) => void
}

class ServiceRunner {
  private services = new Map<string, ServiceDef>()
  private semaphores = new Map<string, Semaphore>()
  private rateLimiters = new Map<string, RateLimiter>()
  private pureExecutionControllers = new Map<number, AbortController>()

  initialize(): void {
    const config = getConfig()
    for (const [name, svcConfig] of Object.entries(config.services)) {
      this.semaphores.set(name, new Semaphore(svcConfig.max_concurrency))
      this.rateLimiters.set(
        name,
        new RateLimiter((svcConfig.rate_limit_interval || 0) * 1000)
      )
    }
  }

  register(def: ServiceDef): void {
    this.services.set(def.name, def)
    // Ensure semaphore/rate limiter exist even if not in config
    if (!this.semaphores.has(def.name)) {
      this.semaphores.set(def.name, new Semaphore(2))
    }
    if (!this.rateLimiters.has(def.name)) {
      this.rateLimiters.set(def.name, new RateLimiter(0))
    }
  }

  getRegisteredServices(): ServiceDef[] {
    return Array.from(this.services.values())
  }

  getServiceInfo(): Array<{ name: string; type: string; running: number; pending: number; max_concurrency: number }> {
    return Array.from(this.services.entries()).map(([name, def]) => {
      const sem = this.semaphores.get(name)
      const config = getConfig().services[name]
      return {
        name,
        type: def.type,
        running: sem?.running || 0,
        pending: sem?.pending || 0,
        max_concurrency: config?.max_concurrency || 2,
      }
    })
  }

  async executePureService(
    serviceName: string,
    paperId: number | null,
    executeFn: (context: PureServiceExecutionContext) => Promise<any>,
    options: PureServiceExecutionOptions = {},
  ): Promise<{ executionId: number }> {
    const db = getDatabase()
    const now = new Date().toISOString()

    // Create execution record (paper_id can be 0 for non-paper-bound)
    const execution = db.insert(schema.serviceExecutions).values({
      service_name: serviceName,
      paper_id: paperId || 0,
      status: 'pending',
      progress: 0,
      created_at: now,
    }).returning().get()

    const sem = this.semaphores.get(serviceName)
    const rl = this.rateLimiters.get(serviceName)
    const controller = new AbortController()
    const context = { executionId: execution.id, signal: controller.signal }
    this.pureExecutionControllers.set(execution.id, controller)

    try {
      // Preparation must finish before the fire-and-forget worker can queue or run.
      // QA uses this to persist its exact Result/execution relationship.
      options.onCreated?.(context)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.pureExecutionControllers.delete(execution.id)
      db.update(schema.serviceExecutions)
        .set({ status: 'failed', finished_at: new Date().toISOString(), error: err.message })
        .where(eq(schema.serviceExecutions.id, execution.id))
        .run()
      throw err
    }

    // Run async — don't block the caller
    ;(async () => {
      let acquired = false
      try {
        if (sem) {
          await sem.acquire(controller.signal)
          acquired = true
        }

        db.update(schema.serviceExecutions)
          .set({ status: 'running' })
          .where(eq(schema.serviceExecutions.id, execution.id))
          .run()

        if (rl) await rl.waitIfNeeded(controller.signal)

        await executeFn(context)

        db.update(schema.serviceExecutions)
          .set({ status: 'done', progress: 100, finished_at: new Date().toISOString(), result: 'OK' })
          .where(eq(schema.serviceExecutions.id, execution.id))
          .run()
      } catch (err: any) {
        db.update(schema.serviceExecutions)
          .set({
            status: 'failed',
            finished_at: new Date().toISOString(),
            error: controller.signal.aborted ? 'cancelled by user' : err.message || String(err),
          })
          .where(eq(schema.serviceExecutions.id, execution.id))
          .run()
      } finally {
        if (sem && acquired) sem.release()
        this.pureExecutionControllers.delete(execution.id)
      }
    })()

    return { executionId: execution.id }
  }

  cancelPureExecution(executionId: number): boolean {
    const controller = this.pureExecutionControllers.get(executionId)
    if (!controller || controller.signal.aborted) return false
    controller.abort()
    return true
  }

  async triggerForPaper(paperId: number): Promise<void> {
    const db = getDatabase()
    const paper = db.select().from(schema.papers).where(eq(schema.papers.id, paperId)).get()
    if (!paper) return

    const paperBoundServices = Array.from(this.services.values()).filter(
      (s): s is PaperBoundServiceDef => s.type === 'paper_bound'
    )

    // Build execution plan
    const plan = this.buildExecutionPlan(paper, paperBoundServices)

    // Execute plan
    const promises: Promise<void>[] = []
    for (const batch of plan) {
      const batchPromises = batch.map((svcName) =>
        this.executeServiceForPaper(svcName, paperId)
      )
      promises.push(...batchPromises)
    }

    // Don't await — let services run in background
    Promise.allSettled(promises).catch(() => {})
  }

  private buildExecutionPlan(paper: any, services: PaperBoundServiceDef[]): string[][] {
    // Simple topological sort based on depends_on/produces
    const remaining = new Map(services.map((s) => [s.name, s]))
    const batches: string[][] = []
    const resolved = new Set<string>()

    // Collect all keys that already exist on the paper
    const existingKeys = this.getExistingKeys(paper)
    for (const key of existingKeys) {
      resolved.add(key)
    }

    // Metadata-only papers (listed=0) defer `requires_listed` services until promotion.
    const isListed = paper.listed !== 0

    let maxIterations = 10
    while (remaining.size > 0 && maxIterations-- > 0) {
      const batch: string[] = []
      for (const [name, svc] of remaining) {
        // Check if all produces already exist
        const allProduced = svc.produces.every((k) => existingKeys.has(k))
        if (allProduced) {
          remaining.delete(name)
          continue
        }

        // Listed gate: defer `requires_listed` services for metadata-only (listed=0) papers
        if (svc.requires_listed && !isListed) {
          this.markDeferred(name, paper.id)
          remaining.delete(name)
          continue
        }

        // Check if depends_on are satisfied
        const depsSatisfied = svc.depends_on.every((k) => resolved.has(k))
        if (depsSatisfied) {
          batch.push(name)
        }
      }

      if (batch.length === 0) {
        // Remaining services are blocked
        for (const name of remaining.keys()) {
          this.markBlocked(name, paper.id)
          remaining.delete(name)
        }
        break
      }

      for (const name of batch) {
        const svc = remaining.get(name)!
        for (const key of svc.produces) {
          resolved.add(key)
        }
        remaining.delete(name)
      }
      batches.push(batch)
    }

    return batches
  }

  private getExistingKeys(paper: any): Set<string> {
    const keys = new Set<string>()
    if (paper.arxiv_id) keys.add('arxiv_id')
    if (paper.corpus_id) keys.add('corpus_id')
    if (paper.pdf_path) keys.add('pdf_path')
    if (paper.metadata) {
      try {
        const meta = typeof paper.metadata === 'string' ? JSON.parse(paper.metadata) : paper.metadata
        for (const k of Object.keys(meta)) keys.add(k)
      } catch {}
    }
    if (paper.contents) {
      try {
        const contents = typeof paper.contents === 'string' ? JSON.parse(paper.contents) : paper.contents
        for (const [k, v] of Object.entries(contents)) {
          if (v) keys.add(`contents.${k}`)
        }
      } catch {}
    }
    return keys
  }

  private markBlocked(serviceName: string, paperId: number): void {
    const db = getDatabase()
    const now = new Date().toISOString()
    db.insert(schema.serviceExecutions).values({
      service_name: serviceName,
      paper_id: paperId,
      status: 'blocked',
      progress: 0,
      created_at: now,
      finished_at: now,
    }).run()
  }

  // Recorded for `requires_listed` services on metadata-only papers: waiting to be
  // promoted to the library (not failed, not blocked-on-dependency).
  private markDeferred(serviceName: string, paperId: number): void {
    const db = getDatabase()
    const now = new Date().toISOString()
    db.insert(schema.serviceExecutions).values({
      service_name: serviceName,
      paper_id: paperId,
      status: 'deferred',
      progress: 0,
      created_at: now,
      finished_at: now,
    }).run()
  }

  async executeServiceForPaper(serviceName: string, paperId: number): Promise<void> {
    const svc = this.services.get(serviceName)
    if (!svc || svc.type !== 'paper_bound') return

    const db = getDatabase()
    const now = new Date().toISOString()

    // Create execution record
    const execution = db.insert(schema.serviceExecutions).values({
      service_name: serviceName,
      paper_id: paperId,
      status: 'pending',
      progress: 0,
      created_at: now,
    }).returning().get()

    const sem = this.semaphores.get(serviceName)!
    const rl = this.rateLimiters.get(serviceName)!

    try {
      // Wait for concurrency slot
      await sem.acquire()

      // Update status to running
      db.update(schema.serviceExecutions)
        .set({ status: 'running' })
        .where(eq(schema.serviceExecutions.id, execution.id))
        .run()

      // Wait for rate limit
      await rl.waitIfNeeded()

      // Get fresh paper data
      const paper = db.select().from(schema.papers).where(eq(schema.papers.id, paperId)).get()
      if (!paper) throw new Error(`Paper ${paperId} not found`)

      // Execute the service
      const result = await (svc as PaperBoundServiceDef).execute(paperId, paper)

      // Apply results to paper
      if (result && Object.keys(result).length > 0) {
        const updates: Record<string, any> = {}

        // Read the paper ONCE and accumulate metadata/contents across all keys.
        // (Re-reading per key would make each metadata/contents write clobber the
        // previous one, so only the last key would survive.)
        const currentPaper = db.select().from(schema.papers).where(eq(schema.papers.id, paperId)).get()
        const metadataObj: Record<string, any> = currentPaper?.metadata ? JSON.parse(currentPaper.metadata) : {}
        const contentsObj: Record<string, any> = currentPaper?.contents ? JSON.parse(currentPaper.contents) : {}
        let metadataChanged = false
        let contentsChanged = false

        for (const [key, value] of Object.entries(result)) {
          if (value === undefined || value === null) continue

          if (key === 'title' || key === 'abstract' || key === 'authors') {
            // Basic fields: only fill if empty
            if (key === 'title' && (!currentPaper?.title || currentPaper.title === 'Untitled')) {
              updates.title = value
            } else if (key === 'abstract' && !currentPaper?.abstract) {
              updates.abstract = value
            } else if (key === 'authors') {
              const currentAuthors = currentPaper?.authors ? JSON.parse(currentPaper.authors) : []
              if (currentAuthors.length === 0) {
                updates.authors = JSON.stringify(value)
              }
            }
          } else if (key === 'arxiv_id' || key === 'corpus_id' || key === 'pdf_path' || key === 'link') {
            // corpus_id is UNIQUE: if another paper already holds it, skip writing
            // it (keeping the rest of the enrichment) instead of failing the run.
            if (key === 'corpus_id') {
              const conflict = db.select().from(schema.papers)
                .where(eq(schema.papers.corpus_id, String(value)))
                .get()
              if (conflict && conflict.id !== paperId) {
                console.warn(`Skipping corpus_id ${value} for paper ${paperId}: already held by paper ${conflict.id}`)
                continue
              }
            }
            updates[key] = value
          } else if (key.startsWith('contents.')) {
            const contentKey = key.replace('contents.', '')
            contentsObj[contentKey] = value
            contentsChanged = true
          } else {
            // Accumulate into a single metadata object, written once below.
            metadataObj[key] = value
            metadataChanged = true
          }
        }

        if (metadataChanged) updates.metadata = JSON.stringify(metadataObj)
        if (contentsChanged) updates.contents = JSON.stringify(contentsObj)

        if (Object.keys(updates).length > 0) {
          db.update(schema.papers)
            .set(updates)
            .where(eq(schema.papers.id, paperId))
            .run()
        }
      }

      // Mark done
      db.update(schema.serviceExecutions)
        .set({ status: 'done', progress: 100, finished_at: new Date().toISOString(), result: 'OK' })
        .where(eq(schema.serviceExecutions.id, execution.id))
        .run()

      // After completing, check if any waiting services can now run
      // Re-trigger to handle newly available keys
      const updatedPaper = db.select().from(schema.papers).where(eq(schema.papers.id, paperId)).get()
      if (updatedPaper) {
        const isListed = updatedPaper.listed !== 0
        const pbServices = Array.from(this.services.values()).filter(
          (s): s is PaperBoundServiceDef => s.type === 'paper_bound' && s.name !== serviceName
        )
        for (const depSvc of pbServices) {
          // Respect the listed gate here too (don't auto-trigger arxiv/etc. for metadata-only papers)
          if (depSvc.requires_listed && !isListed) continue
          // Check if this service should now run
          const depsSatisfied = depSvc.depends_on.every((k) => this.getExistingKeys(updatedPaper).has(k))
          const allProduced = depSvc.produces.every((k) => this.getExistingKeys(updatedPaper).has(k))
          if (depsSatisfied && !allProduced) {
            // Check if not already running/pending
            const existing = db.select().from(schema.serviceExecutions)
              .where(eq(schema.serviceExecutions.paper_id, paperId))
              .all()
              .filter((e) => e.service_name === depSvc.name && (e.status === 'pending' || e.status === 'running' || e.status === 'done'))
            if (existing.length === 0) {
              this.executeServiceForPaper(depSvc.name, paperId).catch(() => {})
            }
          }
        }
      }
    } catch (err: any) {
      db.update(schema.serviceExecutions)
        .set({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error: err.message || String(err),
        })
        .where(eq(schema.serviceExecutions.id, execution.id))
        .run()
    } finally {
      sem.release()
    }
  }
}

export const serviceRunner = new ServiceRunner()
