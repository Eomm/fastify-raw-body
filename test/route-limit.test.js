'use strict'

const t = require('tap')
const Fastify = require('fastify')
const rawBody = require('../plugin')

t.test('body limit per route', async t => {
  const app = Fastify({ bodyLimit: 5 })

  const payload = { hello: '123456789012345678901234567890' }

  await app.register(rawBody, {
    field: 'rawBody',
    global: false,
    runFirst: false
  })

  app.post('/100', {
    config: { rawBody: true },
    bodyLimit: 100
  }, (req, reply) => {
    t.pass('body is ok')
    return req.rawBody
  })

  app.post('/50', {
    config: {
      rawBody: true
    },
    bodyLimit: 41
  }, (req, reply) => {
    t.fail('body is not ok')
  })

  app.post('/server-limit', {
    config: {
      rawBody: true
    }
  }, (req, reply) => {
    t.fail('body is not ok')
  })

  await t.test('must not throw if body is smaller than limit', async t => {
    const res = await app.inject({
      method: 'POST',
      url: '/100',
      payload
    })

    t.equal(res.statusCode, 200)
    t.equal(res.payload, JSON.stringify(payload))
  })

  await t.test('must reject if body is bigger than limit', async t => {
    const res = await app.inject({
      method: 'POST',
      url: '/50',
      payload
    })

    t.equal(res.statusCode, 413)
    t.same(res.json(), {
      statusCode: 413,
      code: 'FST_ERR_CTP_BODY_TOO_LARGE',
      error: 'Payload Too Large',
      message: 'Request body is too large'
    })
  })

  await t.test('must reject if body is bigger then the server limit', async t => {
    const res = await app.inject({
      method: 'POST',
      url: '/server-limit',
      payload: { hello: '1' }
    })

    t.equal(res.statusCode, 413)
    t.same(res.json(), {
      statusCode: 413,
      code: 'FST_ERR_CTP_BODY_TOO_LARGE',
      error: 'Payload Too Large',
      message: 'Request body is too large'
    })
  })
})
