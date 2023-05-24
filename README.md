# Bare Client

This package implements the [TompHTTP Bare Server](https://github.com/tomphttp/specifications/blob/master/BareServer.md) as a client.

See the [changelog](./CHANGELOG.md).

## Quickstart

Script tag:

```html
<script src="https://unpkg.com/@tomphttp/bare-client@1.1.0/dist/BareClient.cjs"></script>
```

ESM/bundler:

```sh
npm i @tomphttp/bare-client
```

See [examples/](examples/).

## Notice

`bareClient.fetch` isn't 1:1 to JavaScript's `fetch`. It doesn't accept a `Request` as an argument due to the headers on the `Request` being "managed":

```js
const a = new Headers(); // unmanaged `Headers`
a.set('user-agent', 'test');
a.get('user-agent'); // "test"

const b = new Request(location.toString()).headers; // managed `Headers`
b.set('user-agent', 'test');
b.get('user-agent'); // null
```
