/* eslint-disable @typescript-eslint/no-explicit-any */
export type BareMethod =
	| 'GET'
	| 'POST'
	| 'DELETE'
	| 'OPTIONS'
	| 'PUT'
	| 'PATCH'
	| 'UPDATE'
	| string;

export type BareCache =
	| 'default'
	| 'no-store'
	| 'reload'
	| 'no-cache'
	| 'force-cache'
	| 'only-if-cached'
	| string;

export interface BareWebSocketMeta {
	protocol: string;
	setCookies: string[];
}

export type BareHTTPProtocol = 'blob:' | 'http:' | 'https:' | string;
export type BareWSProtocol = 'ws:' | 'wss:' | string;

export type urlLike = URL | string;

export const maxRedirects = 20;

export type BareHeaders = Record<string, string | string[]>;

/**
 * metadata with the URL for convenience
 */
export interface BareWebSocketMetaFull extends BareWebSocketMeta {
	url: string;
}

/**
 * A MetaEvent is sent to clients using WebSockets when the metadata is received and before the open event is dispatched.
 * By default, the Bare client will define the protocol and url on the WebSocket.
 * Clients can cancel replace behavior with their own by calling event.preventDefault().
 * */
export interface MetaEvent extends Event {
	/** Returns the metadata received from the server. */
	readonly meta: BareWebSocketMetaFull;
}

/**
 * A ReadyStateEvent is sent to clients using WebSockets whenever the readyState value should change.
 * By default, the Bare client will define the readyState on the WebSocket.
 * This value should only be used as the readyState if the actual readyState is WebSocket.OPEN, otherwise the real readyState should be returned.
 * This is because this readyState value is only used to hide the Bare server being connected to, and to show that the socket is connected to the remote.
 * Clients can cancel replace behavior with their own by calling event.preventDefault().
 **/
export interface ReadyStateEvent extends Event {
	/** Returns the intended readyState value. */
	readonly readyState: number;
}

export interface BareWebSocketEventMap {
	meta: MetaEvent;
	readyState: ReadyStateEvent;
}

/**
 * WebSocket with an additional property.
 */
export interface BareWebSocket extends WebSocket {
	addEventListener: {
		<K extends keyof BareWebSocketEventMap>(
			type: K,
			listener: (this: WebSocket, ev: BareWebSocketEventMap[K]) => any,
			options?: boolean | AddEventListenerOptions
		): void;
	} & WebSocket['addEventListener'];
	removeEventListener: {
		<K extends keyof BareWebSocketEventMap>(
			type: K,
			listener: (this: WebSocket, ev: BareWebSocketEventMap[K]) => any,
			options?: boolean | EventListenerOptions
		): void;
	} & WebSocket['addEventListener'];
}

/**
 * A Response with additional properties.
 */
export interface BareResponse extends Response {
	rawResponse: Response;
	rawHeaders: BareHeaders;
}

/**
 * A BareResponse with additional properties.
 */
export interface BareResponseFetch extends BareResponse {
	finalURL: string;
}

export type BareBodyInit =
	| Blob
	| BufferSource
	| FormData
	| URLSearchParams
	| ReadableStream
	| undefined
	| null;

export type BareFetchInit = {
	method?: BareMethod;
	headers?: Headers | BareHeaders;
	body?: BareBodyInit;
	cache?: BareCache;
	redirect?: 'follow' | 'manual' | 'error' | string;
	signal?: AbortSignal;
};

export interface BareMaintainer {
	email?: string;
	website?: string;
}

export interface BareProject {
	name?: string;
	description?: string;
	email?: string;
	website?: string;
	repository?: string;
	version?: string;
}

export type BareLanguage =
	| 'NodeJS'
	| 'ServiceWorker'
	| 'Deno'
	| 'Java'
	| 'PHP'
	| 'Rust'
	| 'C'
	| 'C++'
	| 'C#'
	| 'Ruby'
	| 'Go'
	| 'Crystal'
	| 'Shell'
	| string;

export interface BareManifest {
	maintainer?: BareMaintainer;
	project?: BareProject;
	versions: string[];
	language: BareLanguage;
	memoryUsage?: number;
}
