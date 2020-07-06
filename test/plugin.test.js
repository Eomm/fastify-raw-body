'use strict'

const t = require('tap')
const Fastify = require('fastify')
const rawBody = require('../plugin')

t.test('raw body flow check', t => {
  t.plan(9)
  const app = Fastify()

  const payload = { hello: 'world' }
  const shouldBe = JSON.stringify(payload)

  app.register(rawBody, { global: false })

  app.addHook('onRequest', (request, reply, done) => {
    t.notOk(request.rawBody)
    done()
  })

  app.addHook('preParsing', function (request, reply, done) {
    t.notOk(request.rawBody)
    done(null, payload)
  })

  app.addHook('preValidation', (request, reply, done) => {
    t.equal(request.rawBody, shouldBe)
    done()
  })

  app.addHook('preHandler', (request, reply, done) => {
    t.equal(request.rawBody, shouldBe)
    done()
  })

  app.addHook('onSend', (request, reply, payload, done) => {
    t.equal(request.rawBody, shouldBe)
    done(null, payload)
  })

  app.post('/', { config: { rawBody: true } }, (req, reply) => {
    t.ok(req.rawBody)
    reply.send(req.rawBody)
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equals(res.payload, shouldBe)
  })
})

t.test('no register raw body twice', t => {
  t.plan(2)
  const app = Fastify()

  app.register(rawBody)
  app.register(rawBody)

  app.ready(err => {
    t.ok(err)
    t.like(err.message, /twice/)
  })
})

t.test('register in plugins', t => {
  t.plan(1)
  const app = Fastify()

  app.register((i, o, next) => {
    i.register(rawBody)
    next()
  })
  app.register((i, o, next) => {
    i.register(rawBody)
    next()
  })

  app.ready(err => { t.error(err) })
})

t.test('raw body not in GET', t => {
  t.plan(8)
  const app = Fastify()

  const payload = { hello: 'world' }
  const shouldBe = JSON.stringify(payload)

  app.register(rawBody)

  app.get('/', (req, reply) => {
    t.notOk(req.rawBody)
    reply.send(`raw=${req.rawBody}`)
  })

  app.post('/', (req, reply) => {
    t.ok(req.rawBody)
    reply.send(req.rawBody)
  })

  app.inject({
    method: 'GET',
    url: '/',
    payload
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equals(res.payload, 'raw=undefined')
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equals(res.payload, shouldBe)
  })
})

t.test('global skip', t => {
  t.plan(8)
  const app = Fastify()

  const payload = { hello: 'world' }
  const shouldBe = JSON.stringify(payload)

  app.register(rawBody)

  app.post('/skip', { config: { rawBody: false } }, (req, reply) => {
    t.notOk(req.rawBody)
    reply.send(`raw=${req.rawBody}`)
  })

  app.post('/', (req, reply) => {
    t.ok(req.rawBody)
    reply.send(req.rawBody)
  })

  app.inject({
    method: 'POST',
    url: '/skip',
    payload
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equals(res.payload, 'raw=undefined')
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equals(res.payload, shouldBe)
  })
})

t.test('raw body is the last body stream value', t => {
  t.plan(14)
  const app = Fastify()

  const payload = { hello: 'world' }

  let order = 0
  app.addHook('preParsing', function (req, reply, done) {
    t.equals(order++, 0)
    done()
  })

  app.register(rawBody)

  app.post('/', (req, reply) => {
    t.deepEquals(req.body, { hello: 'world' })
    t.equals(JSON.stringify(req.body), req.rawBody)
    reply.send(req.rawBody)
  })

  app.post('/preparsing', {
    preParsing: function (req, reply, done) {
      t.equals(order++, 1)
      t.notOk(req.rawBody)
      done()
    }
  }, (req, reply) => {
    t.deepEquals(req.body, { hello: 'world' })
    t.equals(JSON.stringify(req.body), req.rawBody)
    reply.send(req.rawBody)
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equals(res.payload, JSON.stringify({ hello: 'world' }))

    order = 0 // reset the global order
    app.inject({
      method: 'POST',
      url: '/preparsing',
      payload
    }, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equals(res.payload, JSON.stringify({ hello: 'world' }))
    })
  })
})

t.test('raw body run before content type parser', t => {
  t.plan(8)
  const app = Fastify()

  const payload = { hello: 'world' }

  app.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
    const json = JSON.parse(body.toUpperCase())
    done(null, json)
  })

  app.addHook('preParsing', function (req, reply, done) {
    // cannot change payload
    done(null)
  })

  app.register(rawBody, { runFirst: true })

  app.post('/', (req, reply) => {
    t.deepEquals(req.body, { HELLO: 'WORLD' })
    reply.send(req.rawBody)
  })

  app.post('/preparsing', {
    preParsing: function (req, reply, done) {
      done()
    }
  }, (req, reply) => {
    t.deepEquals(req.body, { HELLO: 'WORLD' })
    reply.send(req.rawBody)
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equals(res.payload, JSON.stringify(payload))

    app.inject({
      method: 'POST',
      url: '/preparsing',
      payload
    }, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equals(res.payload, JSON.stringify(payload))
    })
  })
})

t.test('raw body run before content type parser even with buffer', t => {
  t.plan(8)
  const app = Fastify()

  const payload = { hello: 'world' }

  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, function (req, body, done) {
    const json = JSON.parse(body.toString('utf8').toUpperCase())
    done(null, json)
  })

  app.addHook('preParsing', function (req, reply, done) {
    // cannot change payload
    done(null)
  })

  app.register(rawBody, { runFirst: true })

  app.post('/', (req, reply) => {
    t.deepEquals(req.body, { HELLO: 'WORLD' })
    reply.send(req.rawBody)
  })

  app.post('/preparsing', {
    preParsing: function (req, reply, done) {
      done()
    }
  }, (req, reply) => {
    t.deepEquals(req.body, { HELLO: 'WORLD' })
    reply.send(req.rawBody)
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equals(res.payload, JSON.stringify(payload))

    app.inject({
      method: 'POST',
      url: '/preparsing',
      payload
    }, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equals(res.payload, JSON.stringify(payload))
    })
  })
})

t.test('raw body route array - preparsing cannot change payload', t => {
  t.plan(6)
  const app = Fastify()

  const payload = { hello: 'world' }

  app.register(rawBody)

  app.post('/preparsing', {
    preParsing: [function (req, reply, done) {
      t.notOk(req.rawBody)
      done()
    }]
  }, (req, reply) => {
    t.deepEquals(req.body, { hello: 'world' })
    t.equals(JSON.stringify(req.body), req.rawBody)
    reply.send(req.rawBody)
  })

  app.inject({
    method: 'POST',
    url: '/preparsing',
    payload
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equals(res.payload, JSON.stringify({ hello: 'world' }))
  })
})

t.test('raw body change default name', t => {
  t.plan(5)
  const app = Fastify()

  const payload = { hello: 'world' }

  app.register(rawBody, { field: 'rawRawRaw', encoding: false })

  app.post('/', (req, reply) => {
    t.deepEquals(req.body, { hello: 'world' })
    t.type(req.rawRawRaw, Buffer)
    reply.send(req.rawRawRaw)
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equals(res.payload, JSON.stringify(payload))
  })
})

t.test('raw body buffer', t => {
  t.plan(5)
  const app = Fastify()

  const payload = { hello: 'world' }

  app.register(rawBody, { encoding: false })

  app.post('/', (req, reply) => {
    t.deepEquals(req.body, { hello: 'world' })
    t.type(req.rawBody, Buffer)
    reply.send(req.rawBody)
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equals(res.payload, JSON.stringify(payload))
  })
})

t.test('body limit', t => {
  t.plan(2)
  const app = Fastify({ bodyLimit: 5 })

  const payload = { hello: 'world' }

  app.register(rawBody, { encoding: false })

  app.post('/', (req, reply) => {
    t.fail('body is too large')
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 413)
  })
})

t.test('empty body', t => {
  t.plan(2)
  const app = Fastify()

  app.register(rawBody, { encoding: false })

  app.post('/', (req, reply) => {
    t.fail('body is too small')
  })

  app.inject({
    method: 'POST',
    url: '/',
    headers: { 'content-type': 'application/json' },
    payload: ''
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 400)
  })
})

t.test('bad json body', t => {
  t.plan(2)
  const app = Fastify()

  app.register(rawBody, { encoding: false })

  app.post('/', (req, reply) => {
    t.fail('body is not a json')
  })

  app.inject({
    method: 'POST',
    url: '/',
    headers: { 'content-type': 'application/json' },
    payload: '{"ops":'
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 400)
  })
})
