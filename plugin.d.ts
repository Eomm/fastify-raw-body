import { FastifyPluginCallback } from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string | Buffer
  }

  interface FastifyContextConfig {
    rawBody?: boolean
  }
}

type FastifyRawBody = FastifyPluginCallback<fastifyRawBody.RawBodyPluginOptions> 

declare namespace fastifyRawBody {
  export interface RawBodyPluginOptions {
    field?: string
    global?: boolean
    encoding?: string | null | false
    runFirst?: boolean
    routes?: string[]
    jsonContentTypes?: string[]
  }

  export const fastifyRawBody: FastifyRawBody;
  export { fastifyRawBody as default };
}


declare function fastifyRawBody(...params: Parameters<FastifyRawBody>): ReturnType<FastifyRawBody>
export = fastifyRawBody
