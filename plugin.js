'use strict'

const fp = require('fastify-plugin')
const secureJson = require('secure-json-parse')

const kRawBodyHook = Symbol('fastify-raw-body:rawBodyHook')

function rawBody (fastify, opts, next) {
  if (fastify[kRawBodyHook] === true) {
    next(new Error('Cannot register fastify-raw-body twice'))
    return
  }

  const { field, encoding, global, runFirst, routes, jsonContentTypes } = Object.assign({
    field: 'rawBody',
    encoding: 'utf8',
    global: true,
    runFirst: false,
    routes: [],
    jsonContentTypes: ['application/json']
  }, opts)

  if (encoding === false) {
    fastify.addContentTypeParser(jsonContentTypes,
      { parseAs: 'buffer' },
      almostDefaultJsonParser)
  }

  fastify.addHook('onRoute', (routeOptions) => {
    const wantSkip = routeOptions.method === 'GET' || (routeOptions.config && routeOptions.config.rawBody === false)

    if (
      (global && !wantSkip && !routes.length) ||
      (routeOptions.config && routeOptions.config.rawBody === true) ||
      routes.includes(routeOptions.path)
    ) {
      if (!routeOptions.preParsing) {
        routeOptions.preParsing = [preparsingRawBody]
      } else if (Array.isArray(routeOptions.preParsing)) {
        if (runFirst) {
          routeOptions.preParsing.unshift(preparsingRawBody)
        } else {
          routeOptions.preParsing.push(preparsingRawBody)
        }
      } else {
        if (runFirst) {
          routeOptions.preParsing = [preparsingRawBody, routeOptions.preParsing]
        } else {
          routeOptions.preParsing = [routeOptions.preParsing, preparsingRawBody]
        }
      }
    }
  })

  fastify[kRawBodyHook] = true
  next()

  function preparsingRawBody (request, reply, payload, done) {
    /**
     * The raw body is captured by observing the stream, while `payload` is
     * forwarded untouched so that the fastify server keeps parsing it, enforces
     * its own body limit (the client-facing 413 stays `FST_ERR_CTP_BODY_TOO_LARGE`)
     * and any following preParsing hook still receives the same stream.
     *
     * `request[field]` is assigned on the `end` event: this listener is
     * registered before the server's own content-type parser attaches its
     * listeners, so it runs first and the raw body is always available by the
     * time the route handler executes.
     */
    const source = runFirst ? request.raw : payload
    const chunks = []

    source.on('data', function (chunk) {
      chunks.push(Buffer.from(chunk))
    })
    source.on('end', function () {
      const raw = Buffer.concat(chunks)
      request[field] = encoding === false ? raw : raw.toString(encoding)
    })

    done(null, payload)
  }

  function almostDefaultJsonParser (req, body, done) {
    if (body.length === 0 || body == null) {
      const err = new Error("Body cannot be empty when content-type is set to 'application/json'")
      err.statusCode = 400
      return done(err)
    }

    try {
      const json = secureJson.parse(body.toString('utf8'), {
        protoAction: fastify.initialConfig.onProtoPoisoning,
        constructorAction: fastify.initialConfig.onConstructorPoisoning
      })
      done(null, json)
    } catch (err) {
      err.statusCode = 400
      return done(err)
    }
  }
}

const plugin = fp(rawBody, {
  fastify: '^5.x',
  name: 'fastify-raw-body'
})

module.exports = plugin
module.exports.default = plugin
module.exports.fastifyRawBody = plugin
