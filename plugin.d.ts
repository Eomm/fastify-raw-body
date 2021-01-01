import { FastifyPluginCallback } from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string | Buffer
  }
}

export interface RawBodyPluginOptions {
  field?: string
  global?: boolean
  encoding?: string | null | false
  runFirst?: boolean
}

declare const fastifyRawBody: FastifyPluginCallback<RawBodyPluginOptions>
export default fastifyRawBody
