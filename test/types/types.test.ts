import fastifyFactory from 'fastify'
import rawBodyPlugin, { RawBodyPluginOptions } from '../../plugin'

const optionsNone: RawBodyPluginOptions = {}
const options1: RawBodyPluginOptions = { global: false }
const options2: RawBodyPluginOptions = { field: 'bodyRaw' }
const options3: RawBodyPluginOptions = { encoding: false }
const options4: RawBodyPluginOptions = { runFirst: false }
const options5: RawBodyPluginOptions = { field: 'rawBuffer', encoding: false }

const fastify = fastifyFactory()
fastify.register(rawBodyPlugin, optionsNone)
fastify.register(rawBodyPlugin, options1)
fastify.register(rawBodyPlugin, options2)
fastify.register(rawBodyPlugin, options3)
fastify.register(rawBodyPlugin, options4)
fastify.register(rawBodyPlugin, options5)
