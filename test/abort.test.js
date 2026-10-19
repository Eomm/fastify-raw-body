'use strict'

const t = require('tap')
const http = require('http')
const Fastify = require('fastify')
const rawBody = require('../plugin')

t.test('client aborts the request while the body is being sent', t => {
  t.plan(2)

  const app = Fastify()

  app.register(rawBody)
    .then(() => {
      app.post('/', (req, reply) => {
        reply.send(req.rawBody)
      })

      app.listen({ port: 0 }, (err) => {
        t.error(err)
        t.teardown(() => app.close())

        const { port } = app.server.address()
        const req = http.request({
          port,
          method: 'POST',
          path: '/',
          headers: {
            // announce more bytes than we will actually send, then bail out
            'content-length': '1024',
            'content-type': 'text/plain'
          }
        })

        req.on('error', () => {})
        req.write('partial body')

        // give the server a chance to receive the partial chunk, then abort
        setTimeout(() => {
          req.destroy()
          // the server must survive the aborted request (no uncaughtException)
          setTimeout(() => {
            t.pass('server is still running after the client aborted')
          }, 200)
        }, 100)
      })
    })
})
