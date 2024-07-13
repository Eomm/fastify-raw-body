import t from 'tap'
import Fastify from 'fastify'

await t.test('register in plugins', async t => {
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
})
