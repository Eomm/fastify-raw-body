# fastify-raw-body

Adds the raw body to the Fastify **v3** request object.

## Install

```
npm i fastify-raw-body
```

## Usage

This plugin will add the `request.rawBody`. It will get the data thanks to the [`preParsing`](https://github.com/fastify/fastify/blob/master/docs/Hooks.md#preparsing) hook.

```js
const Fastify = require('fastify')
const app = Fastify()

app.register(require('fastify-raw-body'), { 
  global: false, // add the rawBody to every request. **Default true**
  encoding: 'utf8', // set it to false to set rawBody as a Buffer **Default utf8**
  runFirst: true // get the body before any preParsing hook change/uncompress it. **Default false**
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

## License

Licensed under [MIT](./LICENSE).
