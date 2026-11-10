import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import Fastify, { type FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import type { TopicSnapshot } from '@paperland/shared'
import { topicFixture } from '../testing/topic_fixture'
import { schema } from '../db/index'
import { paperRoutes } from '../api/papers'
import { rebuildTopicIndex, topicTagsByPapers } from './topic_index'
import { setTopicMember } from './topic_access'
import { addToLibrary } from './user_library'

let f: ReturnType<typeof topicFixture>, app: FastifyInstance, id: number, who = 1
let snapshot: TopicSnapshot
beforeEach(async () => {
  f = topicFixture(); who = 1
  snapshot = { topic: { format_version: 1, title: 'Survey', description: '' }, report: '# Report', list: { format_version: 1, directories: [{ id: 'a', name: 'Methods', parent_id: null }, { id: 'b', name: 'Nested', parent_id: 'a' }, { id: 'c', name: 'Other', parent_id: null }], papers: [{ id: 'entry', title: 'Local', paper_id: 10, directory_ids: ['b'], comment: '' }] } }
  id = f.db.insert(schema.topics).values({ owner_id: 1, title: 'Survey', created_at: f.now, updated_at: f.now }).returning().get().id
  f.db.insert(schema.topicMembers).values({ topic_id: id, user_id: 1, role: 'owner' }).run()
  await setTopicMember(id, 1, 'editor', 'editor'); await setTopicMember(id, 1, 'viewer', 'viewer')
  rebuildTopicIndex(id, snapshot)
  app = Fastify(); app.addHook('onRequest', async (request) => { request.user = { id: who, username: 'fixture', nickname: null, role: 'user' } })
  await app.register(paperRoutes)
})
afterEach(async () => { await app.close(); f.close() })

describe('Topic-generated hierarchy and private-tag composition (offline)', () => {
  test('keeps stable node identity and manual tags during rename/move and exposes only a root badge', async () => {
    const manual = f.db.insert(schema.tags).values({ user_id: 1, name: 'Survey' }).returning().get()
    f.db.insert(schema.paperTags).values({ paper_id: 10, tag_id: manual.id }).run()
    expect(topicTagsByPapers([10], 2).get(10)).toEqual([{ topic_id: id, node_id: 'root', name: 'Survey' }])
    expect(topicTagsByPapers([10], 4).size).toBe(0)
    snapshot.list.directories[0].name = 'Renamed'
    snapshot.list.directories[1].parent_id = 'c'
    rebuildTopicIndex(id, snapshot)
    expect(f.db.select().from(schema.topicNodes).all().find((n) => n.node_id === 'a')?.name).toBe('Renamed')
    expect(f.db.select().from(schema.topicPapers).all().map((p) => p.node_id).sort()).toEqual(['b', 'c', 'root'])
    expect(f.db.select().from(schema.paperTags).all()).toHaveLength(1)
    await setTopicMember(id, 1, 'editor', null)
    expect(topicTagsByPapers([10], 2).size).toBe(0)
    expect(topicTagsByPapers([10], 3).size).toBe(1)
  })
  test('combines root/ancestor filters, personal scope and owned manual tags without leaks', async () => {
    for (const node of ['root', 'a', 'b']) {
      const result = await app.inject({ url: `/api/papers?scope=all&topic_id=${id}&topic_node_id=${node}` })
      expect(result.statusCode).toBe(200)
      expect(result.json().data.map((p: any) => p.id)).toEqual([10])
      expect(result.json().data[0].topic_tags).toHaveLength(1)
    }
    expect((await app.inject({ url: `/api/papers?scope=all&topic_id=${id}&topic_node_id=c` })).json().data).toEqual([])
    expect((await app.inject({ url: `/api/papers?scope=mine&topic_id=${id}` })).json().data).toEqual([])
    addToLibrary(1, 10)
    expect((await app.inject({ url: `/api/papers?scope=mine&topic_id=${id}` })).json().data).toHaveLength(1)
    const privateTag = f.db.insert(schema.tags).values({ user_id: 2, name: 'Private' }).returning().get()
    f.db.insert(schema.paperTags).values({ paper_id: 10, tag_id: privateTag.id }).run()
    expect((await app.inject({ url: `/api/papers?scope=all&topic_id=${id}&tag_ids=${privateTag.id}` })).json().data).toEqual([])
    who = 2
    expect((await app.inject({ url: `/api/papers?scope=all&topic_id=${id}&tag_ids=${privateTag.id}` })).json().data).toHaveLength(1)
    await setTopicMember(id, 1, 'editor', null)
    expect((await app.inject({ url: `/api/papers?scope=all&topic_id=${id}` })).statusCode).toBe(404)
    expect((await app.inject({ url: '/api/papers/10' })).json().topic_tags).toEqual([])
  })
  test('removing one Topic association leaves other Topics and all private tags intact', () => {
    const other = f.db.insert(schema.topics).values({ owner_id: 1, title: 'Other Topic', created_at: f.now, updated_at: f.now }).returning().get()
    f.db.insert(schema.topicMembers).values({ topic_id: other.id, user_id: 1, role: 'owner' }).run()
    rebuildTopicIndex(other.id, snapshot)
    snapshot.list.papers = []
    rebuildTopicIndex(id, snapshot)
    expect(topicTagsByPapers([10], 1).get(10)?.map((t) => t.topic_id)).toEqual([other.id])
  })
})
