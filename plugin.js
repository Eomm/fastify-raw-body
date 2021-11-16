'use strict'

const fp = require('fastify-plugin')
const getRawBody = require('raw-body')
const secureJson = require('secure-json-parse')

const kRawBodyHook = Symbol('fastify-raw-body:rawBodyHook')

function rawBody (fastify, opts, next) {
  if (fastify[kRawBodyHook] === true) {
    next(new Error('Cannot register fastify-raw-body twice'))
    return
  }

  const { field, encoding, global, runFirst, routes } = Object.assign({
    field: 'rawBody',
    encoding: 'utf8',
    global: true,
    runFirst: false,
    routes: []
  }, opts)

  if (encoding === false) {
    fastify.addContentTypeParser('application/json',
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
    getRawBody(runFirst ? request.raw : payload, {
      length: null, // avoid content lenght check: fastify will do it
      limit: fastify.initialConfig.bodyLimit, // limit to avoid memory leak or DoS
      encoding
    }, function (err, string) {
      if (err) {
        /**
         * the error is managed by fastify server
         * so the request object will not have any
         * `body` parsed
         */
        return
      }

      request[field] = string
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
      var json = secureJson.parse(body.toString('utf8'), {
        protoAction: fastify.initialConfig.onProtoPoisoning,
        constructorAction: fastify.initialConfig.onConstructorPoisoning
      })
    } catch (err) {
      err.statusCode = 400
      return done(err)
    }
    done(null, json)
  }
}

module.exports = fp(rawBody, {
  fastify: '^3.0.0',
  name: 'fastify-raw-body'
})
