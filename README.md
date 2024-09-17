# fastify-raw-body

[![Build Status](https://github.com/Eomm/fastify-raw-body/workflows/ci/badge.svg)](https://github.com/Eomm/fastify-raw-body/actions)
[![npm](https://img.shields.io/npm/v/fastify-raw-body)](https://www.npmjs.com/package/fastify-raw-body)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

Adds the raw body to the Fastify request object.

## Install

```
npm i fastify-raw-body
```

### Compatibility

| Plugin version | Fastify version |
| ------------- |:---------------:|
| `^5.0.0` | `^5.0.0` |
| `^4.2.1` | `^4.19.0` |
| `^4.0.0` | `^4.0.0` |
| `^3.0.0` | `^3.0.0` |
| `^2.0.0` | `^2.0.0` |


## Usage

This plugin will add the `request.rawBody`.  
It will get the data using the [`preParsing`](https://www.fastify.io/docs/latest/Reference/Hooks/#preparsing) hook.

```js
import Fastify from 'fastify'

const app = Fastify()
await app.register(import('fastify-raw-body'), {
  field: 'rawBody', // change the default request.rawBody property name
  global: false, // add the rawBody to every request. **Default true**
  encoding: 'utf8', // set it to false to set rawBody as a Buffer **Default utf8**
  runFirst: true, // get the body before any preParsing hook change/uncompress it. **Default false**
  routes: [], // array of routes, **`global`** will be ignored, wildcard routes not supported
  jsonContentTypes: [], // array of content-types to handle as JSON. **Default ['application/json']**
})

app.post('/', {
  config: {
    // add the rawBody to this route. if false, rawBody will be disabled when global is true
    rawBody: true
  },
  handler (req, reply) {
    // req.rawBody the string raw body
    reply.send(req.rawBody)
  }
})
```

> **Note**  
> You need to `await` the plugin registration to make sure the plugin is ready to use.
> All the routes defined **before** the plugin registration will be ignored.
> This change has been introduced in Fastify v4.

> **Warning**  
> Setting `global: false` and then the route configuration `{ config: { rawBody: true } }` will
> save memory of your server since the `rawBody` is a copy of the `body` and it will double the memory usage.  
> So use it only for the routes that you need to.

### Raw body as Buffer

It is important to know that setting `encoding: false` will run [`addContentTypeParser`](https://www.fastify.io/docs/master/ContentTypeParser/) to add a content type parser for `application/json`.

This is needed since the default content type parser will set the encoding of the request stream to `{ parseAs: 'string' }`.

If you haven't customized this component, it will be secure as the original one since [`secure-json-parse`](https://www.npmjs.com/package/secure-json-parse) is used under the hood.

## License

Copyright [Manuel Spigolon](https://github.com/Eomm), Licensed under [MIT](./LICENSE).
