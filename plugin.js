'use strict'

const fp = require('fastify-plugin')
const getRawBody = require('raw-body')

const kRawBodyHook = Symbol('fastify-raw-body:rawBodyHook')

function rawBody (fastify, opts, next) {
  if (fastify[kRawBodyHook] === true) {
    next(new Error('Cannot register fastify-raw-body twice'))
    return
  }

  const { encoding, global, runFirst } = Object.assign({
    encoding: 'utf8',
    global: true,
    runFirst: false
  }, opts)

  fastify.addHook('onRoute', (routeOptions) => {
    const wantSkip = routeOptions.method === 'GET' || (routeOptions.config && routeOptions.config.rawBody === false)

    if ((global && !wantSkip) || (routeOptions.config && routeOptions.config.rawBody === true)) {
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
      length: null, // avoid content lenght check
      limit: fastify.initialConfig.bodyLimit,
      encoding
    }, function (_, string) {
      // if (err) { return done(err) } // TODO
      request.rawBody = string
    })
    done(null, payload)
  }
}

module.exports = fp(rawBody, {
  fastify: '^3.0.0',
  name: 'fastify-raw-body'
})
