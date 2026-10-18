import { test } from 'node:test'
import Fastify from 'fastify'

test('register in plugins', async (t) => {
  const app = Fastify()

  app.register((i, o, next) => {
    i.register(import('../plugin.js'))
    next()
  })
  app.register((i, o, next) => {
    i.register(import('../plugin.js'))
    next()
  })

  await app.ready()
  t.assert.ok(app, 'app is ready')
})
