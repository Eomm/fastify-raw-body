import fastify from "fastify"
import { Server, IncomingMessage, ServerResponse } from "http"

declare const fp: fastify.Plugin<Server, IncomingMessage, ServerResponse, any>
export default fp
