import { FastifyPluginCallback } from 'fastify'

declare namespace FastifyRawBody {
  interface Options {
    field: string
    global: boolean
    encoding: string | null | false
    runFirst: boolean
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    rawBody: string | Buffer
  }
}

declare const fastifyRawBody: FastifyPluginCallback<FastifyRawBody.Options>
export default fastifyRawBody
