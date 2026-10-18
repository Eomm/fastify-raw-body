'use strict'

const { test } = require('node:test')
const Fastify = require('fastify')
const { Transform, Readable } = require('stream')
const rawBody = require('../plugin')

test('raw body flow check', async t => {
  const app = Fastify()

  const payload = { hello: 'world' }
  const shouldBe = JSON.stringify(payload)

  await app.register(rawBody, { global: false })

  // Capture rawBody value at each lifecycle hook instead of asserting inside
  // the hook (node:test's strict assertions throw, which would surface as
  // 500 responses and break this test's final assertions).
  const captured = {}

  app.addHook('onRequest', (request, reply, done) => {
    captured.onRequest = request.rawBody
    done()
  })

  app.addHook('preParsing', (request, reply, payload, done) => {
    captured.preParsing = request.rawBody
    done(null, payload)
  })

  app.addHook('preValidation', (request, reply, done) => {
    captured.preValidation = request.rawBody
    done()
  })

  app.addHook('preHandler', (request, reply, done) => {
    captured.preHandler = request.rawBody
    done()
  })

  app.addHook('onSend', (request, reply, payload, done) => {
    captured.onSend = request.rawBody
    done(null, payload)
  })

  app.post('/', { config: { rawBody: true } }, (req, reply) => {
    captured.handler = !!req.rawBody
    reply.send(req.rawBody)
  })

  const res = await app.inject({
    method: 'POST',
    url: '/',
    payload
  })
  t.assert.strictEqual(captured.onRequest, undefined)
  t.assert.strictEqual(captured.preParsing, undefined)
  t.assert.strictEqual(captured.preValidation, shouldBe)
  t.assert.strictEqual(captured.preHandler, shouldBe)
  t.assert.strictEqual(captured.onSend, shouldBe)
  t.assert.ok(captured.handler)
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.payload, shouldBe)
})

test('no register raw body twice', async t => {
  const app = Fastify()

  app.register(rawBody)
  app.register(rawBody)

  await t.assert.rejects(app.ready(), /twice/)
})

test('wrong fastify version', async t => {
  const app = Fastify()

  Object.defineProperty(app, 'version', {
    value: '4.0.0'
  })

  app.register(rawBody)

  await t.assert.rejects(
    app.ready(),
    /expected '\^5.x' fastify version/
  )
})

test('register in plugins', async t => {
  const app = Fastify()

  app.register((i, o, next) => {
    i.register(rawBody)
    next()
  })
  app.register((i, o, next) => {
    i.register(rawBody)
    next()
  })

  await app.ready()
})

test('raw body not in GET', async t => {
  const app = Fastify()

  const payload = { hello: 'world' }
  const shouldBe = JSON.stringify(payload)

  await app.register(rawBody)

  let getRawBody
  let postRawBody

  app.get('/', (req, reply) => {
    getRawBody = req.rawBody
    reply.send(`raw=${req.rawBody}`)
  })

  app.post('/', (req, reply) => {
    postRawBody = req.rawBody
    reply.send(req.rawBody)
  })

  let res = await app.inject({
    method: 'GET',
    url: '/',
    payload
  })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.payload, 'raw=undefined')
  t.assert.strictEqual(getRawBody, undefined)

  res = await app.inject({
    method: 'POST',
    url: '/',
    payload
  })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.payload, shouldBe)
  t.assert.ok(postRawBody)
})

test('global skip', async t => {
  const app = Fastify()

  const payload = { hello: 'world' }
  const shouldBe = JSON.stringify(payload)

  await app.register(rawBody)

  app.post('/skip', { config: { rawBody: false } }, (req, reply) => {
    t.assert.strictEqual(req.rawBody, undefined)
    reply.send(`raw=${req.rawBody}`)
  })

  app.post('/', (req, reply) => {
    t.assert.ok(req.rawBody)
    reply.send(req.rawBody)
  })

  let res = await app.inject({
    method: 'POST',
    url: '/skip',
    payload
  })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.payload, 'raw=undefined')

  res = await app.inject({
    method: 'POST',
    url: '/',
    payload
  })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.payload, shouldBe)
})

test('raw body is the last body stream value', async t => {
  const app = Fastify()

  const payload = { hello: 'world' }

  let order = 0
  app.addHook('preParsing', function (req, reply, payload, done) {
    t.assert.strictEqual(order++, 0)
    const change = new Readable()
    change.receivedEncodedLength = parseInt(req.headers['content-length'], 10)
    change.push('{"hello":"another world"}')
    change.push(null)
    done(null, change)
  })

  await app.register(rawBody)

  app.post('/', (req, reply) => {
    t.assert.deepStrictEqual(req.body, { hello: 'another world' })
    t.assert.strictEqual(JSON.stringify(req.body), req.rawBody)
    reply.send(req.rawBody)
  })

  app.post('/preparsing', {
    preParsing: function (req, reply, payload, done) {
      t.assert.strictEqual(order++, 1)
      t.assert.strictEqual(req.rawBody, undefined)
      const change = new Readable()
      change.receivedEncodedLength = parseInt(req.headers['content-length'], 10)
      change.push('{"hello":"last world"}')
      change.push(null)
      done(null, change)
    }
  }, (req, reply) => {
    t.assert.deepStrictEqual(req.body, { hello: 'last world' })
    t.assert.strictEqual(JSON.stringify(req.body), req.rawBody)
    reply.send(req.rawBody)
  })

  let res = await app.inject({
    method: 'POST',
    url: '/',
    payload
  })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.payload, JSON.stringify({ hello: 'another world' }))

  order = 0 // reset the global order
  res = await app.inject({
    method: 'POST',
    url: '/preparsing',
    payload
  })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.payload, JSON.stringify({ hello: 'last world' }))
})

test('raw body is the first body stream value', async t => {
  const app = Fastify()

  const payload = { hello: 'world' }

  app.addHook('preParsing', function (req, reply, payload, done) {
    const transformation = new Transform({
      writableObjectMode: true,
      transform (chunk, encoding, done) {
        this.push(chunk.toString(encoding).toUpperCase())
        done()
      }
    })
    done(null, payload.pipe(transformation))
  })

  await app.register(rawBody, { runFirst: true })

  app.post('/', (req, reply) => {
    t.assert.deepStrictEqual(req.body, { HELLO: 'WORLD' })
    reply.send(req.rawBody)
  })

  app.post('/preparsing', {
    preParsing: function (req, reply, payload, done) {
      const transformation = new Transform({
        writableObjectMode: true,
        transform (chunk, encoding, done) {
          this.push(chunk.toString(encoding).toUpperCase())
          done()
        }
      })
      done(null, payload.pipe(transformation))
    }
  }, (req, reply) => {
    t.assert.deepStrictEqual(req.body, { HELLO: 'WORLD' })
    reply.send(req.rawBody)
  })

  let res = await app.inject({
    method: 'POST',
    url: '/',
    payload
  })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.payload, JSON.stringify(payload))

  res = await app.inject({
    method: 'POST',
    url: '/preparsing',
    payload
  })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.payload, JSON.stringify(payload))
})

test('raw body route array', async t => {
  const app = Fastify()

  const payload = { hello: 'world' }

  await app.register(rawBody)

  app.post('/preparsing', {
    preParsing: [function (req, reply, payload, done) {
      t.assert.strictEqual(req.rawBody, undefined)
      const change = new Readable()
      change.receivedEncodedLength = parseInt(req.headers['content-length'], 10)
      change.push('{"hello":"last world"}')
      change.push(null)
      done(null, change)
    }]
  }, (req, reply) => {
    t.assert.deepStrictEqual(req.body, { hello: 'last world' })
    t.assert.strictEqual(JSON.stringify(req.body), req.rawBody)
    reply.send(req.rawBody)
  })

  const res = await app.inject({
    method: 'POST',
    url: '/preparsing',
    payload
  })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.payload, JSON.stringify({ hello: 'last world' }))
})

test('preparsing run first', async t => {
  const app = Fastify()

  const payload = { hello: 'world' }

  await app.register(rawBody, { runFirst: true })

  app.post('/preparsing', {
    preParsing: [function (req, reply, payload, done) {
      const transformation = new Transform({
        writableObjectMode: true,
        transform (chunk, encoding, done) {
          this.push(chunk.toString(encoding).toUpperCase())
          done()
        }
      })
      done(null, payload.pipe(transformation))
    }]
  }, (req, reply) => {
    t.assert.deepStrictEqual(req.body, { HELLO: 'WORLD' })
    t.assert.strictEqual(req.rawBody, JSON.stringify(payload))
    reply.send(req.rawBody)
  })

  const res = await app.inject({
    method: 'POST',
    url: '/preparsing',
    payload
  })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.payload, JSON.stringify(payload))
})

test('raw body change default name', async t => {
  const app = Fastify()

  const payload = { hello: 'world' }

  await app.register(rawBody, { field: 'rawRawRaw', encoding: false })

  app.post('/', (req, reply) => {
    t.assert.deepStrictEqual(req.body, { hello: 'world' })
    t.assert.ok(req.rawRawRaw instanceof Buffer)
    reply.send(req.rawRawRaw)
  })

  const res = await app.inject({
    method: 'POST',
    url: '/',
    payload
  })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.payload, JSON.stringify(payload))
})

test('raw body buffer', async t => {
  const app = Fastify()

  const payload = { hello: 'world' }

  await app.register(rawBody, { encoding: false })

  app.post('/', (req, reply) => {
    t.assert.deepStrictEqual(req.body, { hello: 'world' })
    t.assert.ok(req.rawBody instanceof Buffer)
    reply.send(req.rawBody)
  })

  const res = await app.inject({
    method: 'POST',
    url: '/',
    payload
  })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.payload, JSON.stringify(payload))
})

test('raw body alternative content-type (application/ld+json)', async t => {
  const app = Fastify()

  const payload = { hello: 'world' }

  await app.register(rawBody, { encoding: false, jsonContentTypes: ['application/ld+json'] })

  app.post('/', (req, reply) => {
    t.assert.deepStrictEqual(req.body, { hello: 'world' })
    t.assert.ok(req.rawBody instanceof Buffer)
    reply.send(req.rawBody)
  })

  const res = await app.inject({
    method: 'POST',
    url: '/',
    headers: { 'content-type': 'application/ld+json' },
    payload
  })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.payload, JSON.stringify(payload))
})

test('body limit', async t => {
  const app = Fastify({ bodyLimit: 5 })

  const payload = { hello: 'world' }

  await app.register(rawBody, { encoding: false })

  app.post('/', (req, reply) => {
    t.assert.fail('body is too large')
  })

  const res = await app.inject({
    method: 'POST',
    url: '/',
    payload
  })
  t.assert.strictEqual(res.statusCode, 413)
  t.assert.deepStrictEqual(res.json(), {
    statusCode: 413,
    code: 'FST_ERR_CTP_BODY_TOO_LARGE',
    error: 'Payload Too Large',
    message: 'Request body is too large'
  })
})

test('empty body', async t => {
  const app = Fastify()

  await app.register(rawBody, { encoding: false })

  app.post('/', (req, reply) => {
    t.assert.fail('body is too small')
  })

  const res = await app.inject({
    method: 'POST',
    url: '/',
    headers: { 'content-type': 'application/json' },
    payload: ''
  })
  t.assert.strictEqual(res.statusCode, 400)
})

test('bad json body', async t => {
  const app = Fastify()

  await app.register(rawBody, { encoding: false })

  app.post('/', (req, reply) => {
    t.assert.fail('body is not a json')
  })

  const res = await app.inject({
    method: 'POST',
    url: '/',
    headers: { 'content-type': 'application/json' },
    payload: '{"ops":'
  })
  t.assert.strictEqual(res.statusCode, 400)
})

test('defined routes', async t => {
  const app = Fastify()
  const payload = { hello: 'world' }
  const shouldBe = JSON.stringify(payload)

  await app.register(rawBody, { routes: ['/test', '/webhook/123'], global: false })

  let mappedRequests = 0
  let unmappedRequest = false

  app.post('/test', (req, reply) => {
    mappedRequests++
    t.assert.ok(req.rawBody)
    reply.send(req.rawBody)
  })

  app.post('/webhook/123', (req, reply) => {
    mappedRequests++
    t.assert.ok(req.rawBody)
    reply.send(req.rawBody)
  })

  app.post('/notmapped', (req, reply) => {
    unmappedRequest = true
    t.assert.strictEqual(req.rawBody, undefined)
    reply.send(`raw=${req.rawBody}`)
  })

  let res = await app.inject({
    method: 'POST',
    url: '/test',
    payload
  })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.payload, shouldBe)

  res = await app.inject({
    method: 'POST',
    url: '/webhook/123',
    payload
  })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.payload, shouldBe)

  res = await app.inject({
    method: 'POST',
    url: '/notmapped',
    payload
  })
  t.assert.strictEqual(res.statusCode, 200)
  t.assert.strictEqual(res.payload, 'raw=undefined')
  t.assert.strictEqual(mappedRequests, 2)
  t.assert.ok(unmappedRequest)
})
