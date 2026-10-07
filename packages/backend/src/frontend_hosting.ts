import type { FastifyInstance, FastifyReply } from 'fastify'
import fastifyStatic from '@fastify/static'
import { existsSync, realpathSync, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'

/** Mount a production SPA when a build exists; API-only development remains available. */
export async function registerFrontendHosting(
  app: FastifyInstance,
  buildRoot = resolve(process.cwd(), 'packages/frontend/dist'),
): Promise<boolean> {
  const root = resolve(buildRoot)
  if (!existsSync(resolve(root, 'index.html'))) return false
  const realRoot = realpathSync(root)

  await app.register(fastifyStatic, { root, serve: false, cacheControl: false })

  function entry(reply: FastifyReply) {
    return reply.header('Cache-Control', 'no-cache').sendFile('index.html')
  }

  app.get('/', (_request, reply) => entry(reply))
  app.get<{ Params: { '*': string } }>('/*', (request, reply) => {
    const relative = request.params['*']
    const pathname = `/${relative}`
    const notFound = () => reply.code(404).send({ error: 'Not found' })

    // Unknown server routes must never receive SPA HTML, including namespace roots.
    if (/^\/(api|external-api|image)(\/|$)/.test(pathname)) return notFound()

    const file = resolve(root, relative)
    if (!file.startsWith(root + sep) || relative.includes('\0')) return notFound()
    if (existsSync(file) && statSync(file).isFile()) {
      if (!realpathSync(file).startsWith(realRoot + sep)) return notFound()
      const cache = pathname.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache'
      return reply.header('Cache-Control', cache).sendFile(relative)
    }

    if (pathname === '/assets' || pathname.startsWith('/assets/') || extname(relative)) {
      return notFound()
    }
    return entry(reply)
  })
  return true
}
