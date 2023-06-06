# Bare Client

This package implements the [TompHTTP Bare Server](https://github.com/tomphttp/specifications/blob/master/BareServer.md) as a client.

See the [changelog](./CHANGELOG.md).

## Quickstart

Script tag:

```html
<script src="https://unpkg.com/@tomphttp/bare-client@placeholder/dist/bare.cjs"></script>
<script>
	console.log(bare); // { createBareClient: ..., BareClient: ... }

	bare.createBareClient('http://localhost:8080/bare/').then(async (client) => {
		const res = await client.fetch('https://api.github.com/orgs/tomphttp', {
			headers: {
				'user-agent': navigator.userAgent, // user-agent must be passed otherwise the API gives a 403
			},
		});

		console.log(await res.json()); // {login: 'tomphttp', id: 98234273, ... }
	});
</script>
```

ESM/bundler:

```sh
npm i @tomphttp/bare-client
```

```js
import { createBareClient } from '@tomphttp/bare-client';

createBareClient('http://localhost:8080/bare/'); // ...
```

See [examples/](examples/).

## Notice

`client.fetch` isn't 1:1 to JavaScript's `fetch`. It doesn't accept a `Request` as an argument due to the headers on the `Request` being "managed":

```js
const a = new Headers(); // unmanaged `Headers`
a.set('user-agent', 'test');
a.get('user-agent'); // "test"

const b = new Request(location.toString()).headers; // managed `Headers`
b.set('user-agent', 'test');
b.get('user-agent'); // null
```
