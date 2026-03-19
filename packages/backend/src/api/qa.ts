import type { FastifyInstance } from 'fastify'
import { eq, and, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { getConfig } from '../config.js'
import { loadTemplates, loadTemplate } from '../services/template_loader.js'
import { askQuestion, resolveContent } from '../services/qa_service.js'
import { serviceRunner } from '../services/service_runner.js'

function runQA(entryId: number, paperId: number, prompt: string, modelName: string) {
  const db = getDatabase()
  db.update(schema.qaEntries)
    .set({ status: 'running', error: null })
    .where(eq(schema.qaEntries.id, entryId))
    .run()

  // executePureService runs the fn in a fire-and-forget IIFE,
  // so we must handle qa_entries status updates inside executeFn itself.
  serviceRunner.executePureService('qa', paperId, async () => {
    try {
      const res = await askQuestion(paperId, prompt, modelName)
      const latestExec = db.select().from(schema.serviceExecutions)
        .where(and(eq(schema.serviceExecutions.service_name, 'qa'), eq(schema.serviceExecutions.paper_id, paperId)))
        .orderBy(desc(schema.serviceExecutions.created_at))
        .get()

      db.insert(schema.qaResults).values({
        qa_entry_id: entryId,
        prompt,
        answer: res.answer,
        model_name: res.model_name,
        completed_at: new Date().toISOString(),
        execution_id: latestExec?.id || null,
      }).run()
      db.update(schema.qaEntries)
        .set({ status: 'done', error: null })
        .where(eq(schema.qaEntries.id, entryId))
        .run()
    } catch (err: any) {
      console.error(`QA failed (entry ${entryId}):`, err.message)
      db.update(schema.qaEntries)
        .set({ status: 'failed', error: err.message })
        .where(eq(schema.qaEntries.id, entryId))
        .run()
      throw err // re-throw so executePureService also marks service_executions as failed
    }
  })
}

export async function qaRoutes(app: FastifyInstance): Promise<void> {
  // List available templates
  app.get('/api/templates', async () => {
    return { data: loadTemplates().map((t) => ({ name: t.name, prompt: t.prompt })) }
  })

  // Get available models from config
  app.get('/api/config/models', async () => {
    const config = getConfig()
    return { models: { default: config.models.default, available: config.models.available } }
  })

  // List QA entries for a paper
  app.get<{ Params: { id: string } }>('/api/papers/:id/qa', async (request) => {
    const db = getDatabase()
    const paperId = parseInt(request.params.id, 10)

    const entries = db.select().from(schema.qaEntries)
      .where(eq(schema.qaEntries.paper_id, paperId))
      .all()

    const result = []
    for (const entry of entries) {
      const results = db.select().from(schema.qaResults)
        .where(eq(schema.qaResults.qa_entry_id, entry.id))
        .orderBy(desc(schema.qaResults.completed_at))
        .all()
      result.push({ ...entry, results })
    }

    const templateEntries: Record<string, any> = {}
    const freeEntries: any[] = []

    for (const entry of result) {
      if (entry.type === 'template' && entry.template_name) {
        templateEntries[entry.template_name] = {
          entry_id: entry.id,
          status: entry.status,
          error: entry.error,
          results: entry.results,
        }
      } else {
        freeEntries.push({
          entry_id: entry.id,
          status: entry.status,
          error: entry.error,
          prompt: entry.results[0]?.prompt || null,
          results: entry.results,
        })
      }
    }

    return { template: templateEntries, free: freeEntries }
  })

  // Trigger all missing template Q&A
  app.post<{ Params: { id: string } }>('/api/papers/:id/qa/template', async (request, reply) => {
    const db = getDatabase()
    const paperId = parseInt(request.params.id, 10)
    const config = getConfig()
    const defaultModel = config.models.default

    const paper = db.select().from(schema.papers).where(eq(schema.papers.id, paperId)).get()
    if (!paper) {
      reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: 'Paper not found' } })
      return
    }

    const content = resolveContent(paper)
    if (!content) {
      reply.code(422).send({ error: { code: 'NO_CONTENT', message: 'No content available for this paper' } })
      return
    }

    const templates = loadTemplates()
    const triggered: string[] = []

    for (const tmpl of templates) {
      const existing = db.select().from(schema.qaEntries)
        .where(and(eq(schema.qaEntries.paper_id, paperId), eq(schema.qaEntries.type, 'template'), eq(schema.qaEntries.template_name, tmpl.name)))
        .get()

      if (existing) {
        // Skip if already has results or is currently running/pending
        if (existing.status === 'pending' || existing.status === 'running') continue
        const results = db.select().from(schema.qaResults).where(eq(schema.qaResults.qa_entry_id, existing.id)).all()
        if (results.length > 0) continue
      }

      let entryId: number
      if (existing) {
        entryId = existing.id
      } else {
        const entry = db.insert(schema.qaEntries).values({
          paper_id: paperId, type: 'template', template_name: tmpl.name, status: 'pending',
        }).returning().get()
        entryId = entry.id
      }

      triggered.push(tmpl.name)
      runQA(entryId, paperId, tmpl.prompt, defaultModel)
    }

    return { triggered, message: `Triggered ${triggered.length} template questions` }
  })

  // Regenerate a specific template
  app.post<{ Params: { id: string; name: string }; Body: { model?: string } }>('/api/papers/:id/qa/template/:name/regenerate', async (request, reply) => {
    const db = getDatabase()
    const paperId = parseInt(request.params.id, 10)
    const templateName = request.params.name
    const config = getConfig()
    const modelName = (request.body as any)?.model || config.models.default

    const paper = db.select().from(schema.papers).where(eq(schema.papers.id, paperId)).get()
    if (!paper) { reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: 'Paper not found' } }); return }

    const tmpl = loadTemplate(templateName)
    if (!tmpl) { reply.code(404).send({ error: { code: 'TEMPLATE_NOT_FOUND', message: `Template ${templateName} not found` } }); return }

    let entry = db.select().from(schema.qaEntries)
      .where(and(eq(schema.qaEntries.paper_id, paperId), eq(schema.qaEntries.type, 'template'), eq(schema.qaEntries.template_name, templateName)))
      .get()

    if (!entry) {
      entry = db.insert(schema.qaEntries).values({
        paper_id: paperId, type: 'template', template_name: templateName, status: 'pending',
      }).returning().get()
    }

    runQA(entry.id, paperId, tmpl.prompt, modelName)
    return { message: `Regenerating ${templateName}` }
  })

  // Submit free question
  app.post<{ Params: { id: string }; Body: { question: string; models: string[] } }>('/api/papers/:id/qa/free', async (request, reply) => {
    const db = getDatabase()
    const paperId = parseInt(request.params.id, 10)
    const { question, models } = request.body || {}

    if (!question) { reply.code(422).send({ error: { code: 'VALIDATION_ERROR', message: 'Question is required' } }); return }

    const paper = db.select().from(schema.papers).where(eq(schema.papers.id, paperId)).get()
    if (!paper) { reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: 'Paper not found' } }); return }

    const config = getConfig()
    const modelNames = models && models.length > 0 ? models : [config.models.default]

    const entry = db.insert(schema.qaEntries).values({
      paper_id: paperId, type: 'free', status: 'pending',
    }).returning().get()

    for (const modelName of modelNames) {
      runQA(entry.id, paperId, question, modelName)
    }

    return { entry_id: entry.id, models: modelNames, message: 'Question submitted' }
  })

  // Regenerate an existing QA entry
  app.post<{ Params: { entryId: string }; Body: { models?: string[] } }>('/api/qa/:entryId/regenerate', async (request, reply) => {
    const db = getDatabase()
    const entryId = parseInt(request.params.entryId, 10)
    const { models } = request.body || {}

    const entry = db.select().from(schema.qaEntries).where(eq(schema.qaEntries.id, entryId)).get()
    if (!entry) { reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'QA entry not found' } }); return }

    const config = getConfig()
    const modelNames = models && models.length > 0 ? models : [config.models.default]

    let prompt: string
    if (entry.type === 'template' && entry.template_name) {
      const tmpl = loadTemplate(entry.template_name)
      if (!tmpl) { reply.code(404).send({ error: { code: 'TEMPLATE_NOT_FOUND', message: 'Template not found' } }); return }
      prompt = tmpl.prompt
    } else {
      const lastResult = db.select().from(schema.qaResults).where(eq(schema.qaResults.qa_entry_id, entryId)).orderBy(desc(schema.qaResults.completed_at)).get()
      if (!lastResult) { reply.code(422).send({ error: { code: 'NO_PROMPT', message: 'No previous result' } }); return }
      prompt = lastResult.prompt
    }

    for (const modelName of modelNames) {
      runQA(entryId, entry.paper_id, prompt, modelName)
    }

    return { message: `Regenerating with ${modelNames.length} model(s)` }
  })

  // Delete a specific QA result
  app.delete<{ Params: { resultId: string } }>('/api/qa/results/:resultId', async (request, reply) => {
    const db = getDatabase()
    const resultId = parseInt(request.params.resultId, 10)

    const result = db.select().from(schema.qaResults).where(eq(schema.qaResults.id, resultId)).get()
    if (!result) { reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'QA result not found' } }); return }

    db.delete(schema.qaResults).where(eq(schema.qaResults.id, resultId)).run()
    return { message: 'Result deleted' }
  })
}
