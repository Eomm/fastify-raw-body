# fastify-raw-body

![ci](https://github.com/Eomm/fastify-raw-body/workflows/ci/badge.svg)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](http://standardjs.com/)

Adds the raw body to the Fastify request object.

## Install

### Fastify v3

```
npm i fastify-raw-body
```

### Fastify v2

The version `2.x` of this module support Fastify v2 and Node.js>=6

```
npm i fastify-raw-body@2.0.0
```

## Usage

This plugin will add the `request.rawBody`.  
It will get the data using the [`preParsing`](https://github.com/fastify/fastify/blob/master/docs/Hooks.md#preparsing) hook.

```js
const Fastify = require('fastify')
const app = Fastify()

app.register(require('fastify-raw-body'), {
  field: 'rawBody', // change the default request.rawBody property name
  global: false, // add the rawBody to every request. **Default true**
  encoding: 'utf8', // set it to false to set rawBody as a Buffer **Default utf8**
  runFirst: true, // get the body before any preParsing hook change/uncompress it. **Default false**
  routes: [] // array of routes, **`global`** will be ignored, wildcard routes not supported
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

Notice: Setting `global: false` and then the route configuration `{ config: { rawBody: true } }` will
save memory of your server since the `rawBody` is a copy of the `body` and it will double the memory usage.

So use it only for the routes that you need to.

### Raw body as Buffer

It is important to know that setting `encoding: false` will run [`addContentTypeParser`](https://www.fastify.io/docs/master/ContentTypeParser/) to add a content type parser for `application/json`.

This is needed since the default content type parser will set the encoding of the request stream to `{ parseAs: 'string' }`.

If you haven't customized this component, it will be secure as the original one since [`secure-json-parse`](https://www.npmjs.com/package/secure-json-parse) is used under the hood.

## License

Licensed under [MIT](./LICENSE).
