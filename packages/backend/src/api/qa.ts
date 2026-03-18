import type { FastifyInstance } from 'fastify'
import { eq, and, desc } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { getConfig } from '../config.js'
import { loadTemplates, loadTemplate } from '../services/template_loader.js'
import { askQuestion, resolveContent } from '../services/qa_service.js'

export async function qaRoutes(app: FastifyInstance): Promise<void> {
  // List available templates
  app.get('/api/templates', async () => {
    return { data: loadTemplates().map((t) => ({ name: t.name })) }
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
        templateEntries[entry.template_name] = { entry_id: entry.id, results: entry.results }
      } else {
        freeEntries.push({ entry_id: entry.id, results: entry.results })
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
        const results = db.select().from(schema.qaResults).where(eq(schema.qaResults.qa_entry_id, existing.id)).all()
        if (results.length > 0) continue
      }

      let entryId: number
      if (existing) {
        entryId = existing.id
      } else {
        const entry = db.insert(schema.qaEntries).values({ paper_id: paperId, type: 'template', template_name: tmpl.name }).returning().get()
        entryId = entry.id
      }

      triggered.push(tmpl.name)
      askQuestion(paperId, tmpl.content, defaultModel).then((res) => {
        db.insert(schema.qaResults).values({
          qa_entry_id: entryId, prompt: tmpl.content, answer: res.answer,
          model_name: res.model_name, completed_at: new Date().toISOString(),
        }).run()
      }).catch((err) => { console.error(`Template QA failed for ${tmpl.name}:`, err.message) })
    }

    return { triggered, message: `Triggered ${triggered.length} template questions` }
  })

  // Regenerate a specific template
  app.post<{ Params: { id: string; name: string } }>('/api/papers/:id/qa/template/:name/regenerate', async (request, reply) => {
    const db = getDatabase()
    const paperId = parseInt(request.params.id, 10)
    const templateName = request.params.name
    const config = getConfig()

    const paper = db.select().from(schema.papers).where(eq(schema.papers.id, paperId)).get()
    if (!paper) { reply.code(404).send({ error: { code: 'PAPER_NOT_FOUND', message: 'Paper not found' } }); return }

    const tmpl = loadTemplate(templateName)
    if (!tmpl) { reply.code(404).send({ error: { code: 'TEMPLATE_NOT_FOUND', message: `Template ${templateName} not found` } }); return }

    let entry = db.select().from(schema.qaEntries)
      .where(and(eq(schema.qaEntries.paper_id, paperId), eq(schema.qaEntries.type, 'template'), eq(schema.qaEntries.template_name, templateName)))
      .get()

    if (!entry) {
      entry = db.insert(schema.qaEntries).values({ paper_id: paperId, type: 'template', template_name: templateName }).returning().get()
    }

    askQuestion(paperId, tmpl.content, config.models.default).then((res) => {
      db.insert(schema.qaResults).values({
        qa_entry_id: entry!.id, prompt: tmpl!.content, answer: res.answer,
        model_name: res.model_name, completed_at: new Date().toISOString(),
      }).run()
    }).catch((err) => { console.error(`Template regenerate failed:`, err.message) })

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

    const entry = db.insert(schema.qaEntries).values({ paper_id: paperId, type: 'free' }).returning().get()

    for (const modelName of modelNames) {
      askQuestion(paperId, question, modelName).then((res) => {
        db.insert(schema.qaResults).values({
          qa_entry_id: entry.id, prompt: question, answer: res.answer,
          model_name: res.model_name, completed_at: new Date().toISOString(),
        }).run()
      }).catch((err) => { console.error(`Free QA failed for model ${modelName}:`, err.message) })
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
      prompt = tmpl.content
    } else {
      const lastResult = db.select().from(schema.qaResults).where(eq(schema.qaResults.qa_entry_id, entryId)).orderBy(desc(schema.qaResults.completed_at)).get()
      if (!lastResult) { reply.code(422).send({ error: { code: 'NO_PROMPT', message: 'No previous result' } }); return }
      prompt = lastResult.prompt
    }

    for (const modelName of modelNames) {
      askQuestion(entry.paper_id, prompt, modelName).then((res) => {
        db.insert(schema.qaResults).values({
          qa_entry_id: entryId, prompt, answer: res.answer,
          model_name: res.model_name, completed_at: new Date().toISOString(),
        }).run()
      }).catch((err) => { console.error(`Regenerate failed:`, err.message) })
    }

    return { message: `Regenerating with ${modelNames.length} model(s)` }
  })
}
