'use strict'

const t = require('tap')
const Fastify = require('fastify')
const { Transform, Readable } = require('stream')
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
    t.equal(res.payload, shouldBe)
  })
})

t.test('no register raw body twice', t => {
  t.plan(2)
  const app = Fastify()

  app.register(rawBody)
  app.register(rawBody)

  app.ready(err => {
    t.ok(err)
    t.match(err.message, /twice/)
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
    t.equal(res.payload, 'raw=undefined')
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, shouldBe)
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
    t.equal(res.payload, 'raw=undefined')
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, shouldBe)
  })
})

t.test('raw body is the last body stream value', t => {
  t.plan(14)
  const app = Fastify()

  const payload = { hello: 'world' }

  let order = 0
  app.addHook('preParsing', function (req, reply, payload, done) {
    t.equal(order++, 0)
    const change = new Readable()
    change.receivedEncodedLength = parseInt(req.headers['content-length'], 10)
    change.push('{"hello":"another world"}')
    change.push(null)
    done(null, change)
  })

  app.register(rawBody)

  app.post('/', (req, reply) => {
    t.same(req.body, { hello: 'another world' })
    t.equal(JSON.stringify(req.body), req.rawBody)
    reply.send(req.rawBody)
  })

  app.post('/preparsing', {
    preParsing: function (req, reply, payload, done) {
      t.equal(order++, 1)
      t.notOk(req.rawBody)
      const change = new Readable()
      change.receivedEncodedLength = parseInt(req.headers['content-length'], 10)
      change.push('{"hello":"last world"}')
      change.push(null)
      done(null, change)
    }
  }, (req, reply) => {
    t.same(req.body, { hello: 'last world' })
    t.equal(JSON.stringify(req.body), req.rawBody)
    reply.send(req.rawBody)
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, JSON.stringify({ hello: 'another world' }))

    order = 0 // reset the global order
    app.inject({
      method: 'POST',
      url: '/preparsing',
      payload
    }, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(res.payload, JSON.stringify({ hello: 'last world' }))
    })
  })
})

t.test('raw body is the first body stream value', t => {
  t.plan(8)
  const app = Fastify()

  const payload = { hello: 'world' }

  app.addHook('preParsing', function (req, reply, payload, done) {
    const transformation = new Transform({
      writableObjectMode: true,
      transform  (chunk, encoding, done) {
        this.push(chunk.toString(encoding).toUpperCase())
        done()
      }
    })
    done(null, payload.pipe(transformation))
  })

  app.register(rawBody, { runFirst: true })

  app.post('/', (req, reply) => {
    t.same(req.body, { HELLO: 'WORLD' })
    reply.send(req.rawBody)
  })

  app.post('/preparsing', {
    preParsing: function (req, reply, payload, done) {
      const transformation = new Transform({
        writableObjectMode: true,
        transform  (chunk, encoding, done) {
          this.push(chunk.toString(encoding).toUpperCase())
          done()
        }
      })
      done(null, payload.pipe(transformation))
    }
  }, (req, reply) => {
    t.same(req.body, { HELLO: 'WORLD' })
    reply.send(req.rawBody)
  })

  app.inject({
    method: 'POST',
    url: '/',
    payload
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, JSON.stringify(payload))

    app.inject({
      method: 'POST',
      url: '/preparsing',
      payload
    }, (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(res.payload, JSON.stringify(payload))
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
    t.same(req.body, { hello: 'last world' })
    t.equal(JSON.stringify(req.body), req.rawBody)
    reply.send(req.rawBody)
  })

  app.inject({
    method: 'POST',
    url: '/preparsing',
    payload
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, JSON.stringify({ hello: 'last world' }))
  })
})

t.test('preparsing run first', t => {
  t.plan(5)
  const app = Fastify()

  const payload = { hello: 'world' }

  app.register(rawBody, { runFirst: true })

  app.post('/preparsing', {
    preParsing: [function (req, reply, payload, done) {
      const transformation = new Transform({
        writableObjectMode: true,
        transform  (chunk, encoding, done) {
          this.push(chunk.toString(encoding).toUpperCase())
          done()
        }
      })
      done(null, payload.pipe(transformation))
    }]
  }, (req, reply) => {
    t.same(req.body, { HELLO: 'WORLD' })
    t.equal(req.rawBody, JSON.stringify(payload))
    reply.send(req.rawBody)
  })

  app.inject({
    method: 'POST',
    url: '/preparsing',
    payload
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, JSON.stringify(payload))
  })
})

t.test('raw body change default name', t => {
  t.plan(5)
  const app = Fastify()

  const payload = { hello: 'world' }

  app.register(rawBody, { field: 'rawRawRaw', encoding: false })

  app.post('/', (req, reply) => {
    t.same(req.body, { hello: 'world' })
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
    t.equal(res.payload, JSON.stringify(payload))
  })
})

t.test('raw body buffer', t => {
  t.plan(5)
  const app = Fastify()

  const payload = { hello: 'world' }

  app.register(rawBody, { encoding: false })

  app.post('/', (req, reply) => {
    t.same(req.body, { hello: 'world' })
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
    t.equal(res.payload, JSON.stringify(payload))
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

t.test('defined routes', (t) => {
  t.plan(12)
  const app = Fastify()
  const payload = { hello: 'world' }
  const shouldBe = JSON.stringify(payload)
  app.register(rawBody, { routes: ['/test', '/webhook/123'], global: false })

  app.post('/test', (req, reply) => {
    t.ok(req.rawBody)
    reply.send(req.rawBody)
  })

  app.post('/webhook/123', (req, reply) => {
    t.ok(req.rawBody)
    reply.send(req.rawBody)
  })

  app.post('/notmapped', (req, reply) => {
    t.notOk(req.rawBody)
    reply.send(`raw=${req.rawBody}`)
  })

  app.inject(
    {
      method: 'POST',
      url: '/test',
      payload
    },
    (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(res.payload, shouldBe)
    }
  )

  app.inject(
    {
      method: 'POST',
      url: '/webhook/123',
      payload
    },
    (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(res.payload, shouldBe)
    }
  )

  app.inject(
    {
      method: 'POST',
      url: '/notmapped',
      payload
    },
    (err, res) => {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.equal(res.payload, 'raw=undefined')
    }
  )
})
