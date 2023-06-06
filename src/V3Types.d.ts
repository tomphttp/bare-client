import type { BareHeaders } from './BareTypes.js';

export type SocketClientToServer = {
	type: 'connect';
	/**
	 * Remote to connect to
	 */
	remote: string;
	/**
	 * Headers to send to the remote. Usually Cookie, Origin, and User-Agent.
	 */
	headers: BareHeaders;
	/**
	 * Forwards to forward from the WebSocket handshake (eg. User-Agent)
	 */
	forwardHeaders: string[];
};

export type SocketServerToClient = {
	type: 'open';
	/**
	 * The protocl that the remote chose.
	 */
	protocol: string;
	/**
	 * The cookies that the remote wants to set.
	 */
	setCookies: string[];
};
