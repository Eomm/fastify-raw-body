'use strict'

const t = require('tap')
const Fastify = require('fastify')
const { Readable } = require('stream')
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

  app.addHook('preParsing', (request, reply, payload, done) => {
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
  app.addHook('preParsing', function (req, reply, payload, done) {
    t.equals(order++, 0)
    const change = new Readable()
    change.receivedEncodedLength = parseInt(req.headers['content-length'], 10)
    change.push('{"hello":"another world"}')
    change.push(null)
    done(null, change)
  })

  app.register(rawBody)

  app.post('/', (req, reply) => {
    t.deepEquals(req.body, { hello: 'another world' })
    t.equals(JSON.stringify(req.body), req.rawBody)
    reply.send(req.rawBody)
  })

  app.post('/preparsing', {
    preParsing: function (req, reply, payload, done) {
      t.equals(order++, 1)
      t.notOk(req.rawBody)
      const change = new Readable()
      change.receivedEncodedLength = parseInt(req.headers['content-length'], 10)
      change.push('{"hello":"last world"}')
      change.push(null)
      done(null, change)
    }
  }, (req, reply) => {
    t.deepEquals(req.body, { hello: 'last world' })
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
    t.equals(res.payload, JSON.stringify({ hello: 'another world' }))

    order = 0 // reset the global order
    app.inject({
      method: 'POST',
      url: '/preparsing',
      payload
    }, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equals(res.payload, JSON.stringify({ hello: 'last world' }))
    })
  })
})

t.test('raw body route array', t => {
  t.plan(6)
  const app = Fastify()

  const payload = { hello: 'world' }

  app.register(rawBody)

  app.post('/preparsing', {
    preParsing: [function (req, reply, payload, done) {
      t.notOk(req.rawBody)
      const change = new Readable()
      change.receivedEncodedLength = parseInt(req.headers['content-length'], 10)
      change.push('{"hello":"last world"}')
      change.push(null)
      done(null, change)
    }]
  }, (req, reply) => {
    t.deepEquals(req.body, { hello: 'last world' })
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
    t.equals(res.payload, JSON.stringify({ hello: 'last world' }))
  })
})
