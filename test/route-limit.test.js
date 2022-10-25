'use strict'

const t = require('tap')
const Fastify = require('fastify')
const rawBody = require('../plugin')

const payloadMini = { h: 1 }
const payloadSmall = { hello: '1' }
const payloadBig = { hello: '1'.repeat(100) }

const limitError = Object.freeze({
  statusCode: 413,
  code: 'FST_ERR_CTP_BODY_TOO_LARGE',
  error: 'Payload Too Large',
  message: 'Request body is too large'
})

async function buildApp ({
  serverLimit,
  routeLimit
}) {
  const app = Fastify({ bodyLimit: serverLimit })

  await app.register(rawBody, {
    field: 'rawBody',
    global: false,
    runFirst: false
  })

  app.post('/route-limit', {
    config: { rawBody: true },
    bodyLimit: routeLimit,
    handler (req) { return req.rawBody }
  })

  app.post('/server-limit', {
    config: { rawBody: true },
    handler (req) { return req.rawBody }
  })

  return app
}

t.test('body limit per route (route-limit > server-limit)', async t => {
  const app = await buildApp({
    serverLimit: 10,
    routeLimit: 100
  })

  await t.test('must succeed if body is smaller than route limit', async t => {
    const res = await app.inject({
      method: 'POST',
      url: '/route-limit',
      payload: payloadSmall
    })

    t.equal(res.statusCode, 200)
    t.equal(res.payload, JSON.stringify(payloadSmall))
  })

  await t.test('must reject if body is bigger than route limit', async t => {
    const res = await app.inject({
      method: 'POST',
      url: '/route-limit',
      payload: payloadBig
    })

    t.equal(res.statusCode, 413)
    t.same(res.json(), limitError)
  })

  await t.test('must succeed if body is smaller then server limit', async t => {
    const res = await app.inject({
      method: 'POST',
      url: '/server-limit',
      payload: payloadMini
    })

    t.equal(res.statusCode, 200)
    t.equal(res.payload, JSON.stringify(payloadMini))
  })

  await t.test('must reject if body is bigger then the server limit', async t => {
    const res = await app.inject({
      method: 'POST',
      url: '/server-limit',
      payload: payloadSmall
    })

    t.equal(res.statusCode, 413)
    t.same(res.json(), limitError)
  })
})

t.test('body limit per route (route-limit < server-limit)', async t => {
  const app = await buildApp({
    serverLimit: 100,
    routeLimit: 10
  })

  await t.test('must succeed if body is smaller than route limit', async t => {
    const res = await app.inject({
      method: 'POST',
      url: '/route-limit',
      payload: payloadMini
    })

    t.equal(res.statusCode, 200)
    t.equal(res.payload, JSON.stringify(payloadMini))
  })

  await t.test('must reject if body is bigger than route limit', async t => {
    const res = await app.inject({
      method: 'POST',
      url: '/route-limit',
      payload: payloadSmall
    })

    t.equal(res.statusCode, 413)
    t.same(res.json(), limitError)
  })

  await t.test('must succeed if body is smaller then server limit', async t => {
    const res = await app.inject({
      method: 'POST',
      url: '/server-limit',
      payload: payloadSmall
    })

    t.equal(res.statusCode, 200)
    t.equal(res.payload, JSON.stringify(payloadSmall))
  })

  await t.test('must reject if body is bigger then the server limit', async t => {
    const res = await app.inject({
      method: 'POST',
      url: '/server-limit',
      payload: payloadBig
    })

    t.equal(res.statusCode, 413)
    t.same(res.json(), limitError)
  })
})
