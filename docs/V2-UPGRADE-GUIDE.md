# Upgrade to @tomphttp/bare-client v2.x

@tomphttp/bare-client v2.x brings about many changes that provide a more stable API. However, many of these changes mean
that apps written for @tomphttp/bare-client v1.x needs to be updated to work with
@tomphttp/bare-client v2.x. This document helps
you make this transition.

Note that this document is not an exhaustive list of all changes made in v2.x,
but rather that of the most important breaking changes. See our [changelog](/CHANGELOG.md) for
other comparatively minor modifications.

## `.data` property removed

This API was a deprecated getter for the longest time, and now it's been completely removed in v2. Instead, use `.manifest`. The properties are identical.

| API     | Replacement |
| ------- | ----------- |
| `.data` | `.manifest` |

## `.request()` and `.connect()` methods are private

These primitive APIs were exposed for clients that use the legacy remote interface. These APIs accepted Bare remote objects instead of the more simple URL interface. These APIs are now only used internally and can no longer be accessed.

Use the new and more familiar APIs instead:

| API          | Replacement          |
| ------------ | -------------------- |
| `.request()` | `.fetch()`           |
| `.connect()` | `.createWebSocket()` |

## No more WebSocket.meta

If you used `.createWebSocket()`, `socket.meta` used to be a promise. Now it's a dispatched event that comes before the "open" event is dispatched.

```js
const socket = client.createWebSocket(/* ... */);
// socket.meta.then((meta) => console.log("Got the media", meta));
socket.addEventListener('meta', (event) => {
	console.log(event.meta);
});
```

## WebSocket meta no longer contains headers

Headers weren't necessary because all implementations only seek the following:

- extension
- protocol
- set-cookie headers

The WebSocket extension isn't relevant due to it being very implementation specific.

Here's how you can access the new values:

```js
socket.addEventListener('meta', (event) => {
	// The following properties are guaranteed.
	event.meta.protocol; // string
	event.meta.setCookies; // array of strings
});
```

## No more default exports

In v2.x, the way you import the library has been updated for better maintainability.

You should import `BareClient` and `createBareClient` using named imports instead.

Use the following code snippet to update the way you import the library:

```js
// old way
import BareClient, { createBareClient } from '@tomphttp/bare-client';

// new way
import { BareClient, createBareClient } from '@tomphttp/bare-client';
```

## Order of arguments to `.createWebSocket()` changed

In v1, the createWebSocket function accepted the following arguments in this order: `(remote, headers, protocols)`.

In v2, `headers` comes after `protocols`. `(remote, protocols, headers, readyStateHook, sendHook, webSocketImpl)`
