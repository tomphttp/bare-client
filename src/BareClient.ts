import type {
	BareHeaders,
	BareManifest,
	BareResponse,
	BareResponseFetch,
	urlLike,
} from './BareTypes';
import { maxRedirects } from './BareTypes';
import type { Client, WebSocketImpl } from './Client';
import { statusRedirect } from './Client';
import ClientV3 from './V3';
import { validProtocol } from './encodeProtocol';
import { WebSocketFields } from './snapshot';

const clientCtors: [string, { new (server: URL): Client }][] = [
	['v3', ClientV3],
];

export async function fetchManifest(
	server: string | URL,
	signal?: AbortSignal
): Promise<BareManifest> {
	const outgoing = await fetch(server, { signal });

	if (!outgoing.ok) {
		throw new Error(
			`Unable to fetch Bare meta: ${outgoing.status} ${await outgoing.text()}`
		);
	}

	return await outgoing.json();
}

// get the unhooked value
const getRealReadyState = Object.getOwnPropertyDescriptor(
	WebSocket.prototype,
	'readyState'
)!.get!;

const wsProtocols = ['ws:', 'wss:'];

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace BareWebSocket {
	export type GetReadyStateCallback = () => number;
	export type GetSendErrorCallback = () => Error | undefined;
	export type GetProtocolCallback = () => string;
	export type HeadersType = BareHeaders | Headers | undefined;
	export type HeadersProvider =
		| BareHeaders
		| (() => BareHeaders | Promise<BareHeaders>);
}

export class BareClient {
	manfiest?: BareManifest;
	private client?: Client;
	private server: URL;
	private working?: Promise<Client>;
	private onDemand: boolean;
	private onDemandSignal?: AbortSignal;
	/**
	 * Lazily create a BareClient. Calls to fetch and connect will request the manifest once on-demand.
	 * @param server A full URL to the bare server.
	 * @param signal An abort signal for fetching the manifest on demand.
	 */
	constructor(server: string | URL, signal?: AbortSignal);
	/**
	 * Immediately create a BareClient.
	 * @param server A full URL to the bare server.
	 * @param manfiest A Bare server manifest.
	 */
	constructor(server: string | URL, manfiest?: BareManifest);
	constructor(server: string | URL, _?: BareManifest | AbortSignal) {
		this.server = new URL(server);

		if (!_ || _ instanceof AbortSignal) {
			this.onDemand = true;
			this.onDemandSignal = _;
		} else {
			this.onDemand = false;
			this.loadManifest(_);
		}
	}
	private loadManifest(manifest: BareManifest) {
		this.manfiest = manifest;
		this.client = this.getClient();
		return this.client;
	}
	private demand() {
		if (!this.onDemand) return this.client!;

		if (!this.working)
			this.working = fetchManifest(this.server, this.onDemandSignal)
				.then((manfiest) => this.loadManifest(manfiest))
				.catch((err) => {
					// allow the next request to re-fetch the manifest
					// this is to prevent BareClient from permanently failing when used on demand
					delete this.working;
					throw err;
				});

		return this.working;
	}
	private getClient() {
		// newest-oldest
		for (const [version, ctor] of clientCtors)
			if (this.manfiest!.versions.includes(version))
				return new ctor(this.server);

		throw new Error(
			'Unable to find compatible client version. Starting from v2.0.0, @tomphttp/bare-client only supports Bare servers v3+. For more information, see https://github.com/tomphttp/bare-client/'
		);
	}
	/**
	 *
	 * @param readyStateHook A hook executed by this function with helper arguments for hooking the readyState property. If a hook isn't provided, bare-client will hook the property on the instance. Hooking it on an instance basis is good for small projects, but ideally the class should be hooked by the user of bare-client.
	 * @param sendHook A hook executed by this function with helper arguments for hooking the send function. If a hook isn't provided, bare-client will hook the function on the instance.
	 * @param urlHook A hook executed by this function with the URL. If a hook isn't provided, bare-client will hook the URL.
	 * @param protocolHook A hook executed by this function with a helper for getting the current fake protocol. If a hook isn't provided, bare-client will hook the protocol.
	 * @param onSetCookiesCallback A callback executed by this function with an array of cookies. This is called once the metadata from the server is received.
	 */
	createWebSocket(
		remote: urlLike,
		protocols: string | string[] | undefined = [],
		headers: BareWebSocket.HeadersProvider = {},
		readyStateHook?:
			| ((
					socket: WebSocket,
					getReadyState: BareWebSocket.GetReadyStateCallback
			  ) => void)
			| undefined,
		sendHook?:
			| ((
					socket: WebSocket,
					getSendError: BareWebSocket.GetSendErrorCallback
			  ) => void)
			| undefined,
		urlHook?: ((socket: WebSocket, url: URL) => void) | undefined,
		protocolHook?:
			| ((
					socket: WebSocket,
					getProtocol: BareWebSocket.GetProtocolCallback
			  ) => void)
			| undefined,
		onSetCookiesCallback?: ((setCookies: string[]) => void) | undefined,
		webSocketImpl: WebSocketImpl = WebSocket
	): WebSocket {
		if (!this.client)
			throw new TypeError(
				'You need to wait for the client to finish fetching the manifest before creating any WebSockets. Try caching the manifest data before making this request.'
			);

		try {
			remote = new URL(remote);
		} catch (err) {
			throw new DOMException(
				`Faiiled to construct 'WebSocket': The URL '${remote}' is invalid.`
			);
		}

		if (!wsProtocols.includes(remote.protocol))
			throw new DOMException(
				`Failed to construct 'WebSocket': The URL's scheme must be either 'ws' or 'wss'. '${remote.protocol}' is not allowed.`
			);

		if (!Array.isArray(protocols)) protocols = [protocols];

		protocols = protocols.map(String);

		for (const proto of protocols)
			if (!validProtocol(proto))
				throw new DOMException(
					`Failed to construct 'WebSocket': The subprotocol '${proto}' is invalid.`
				);

		const socket = this.client.connect(
			remote,
			protocols,
			async () => {
				const resolvedHeaders =
					typeof headers === 'function' ? await headers() : headers;

				const requestHeaders: BareHeaders =
					resolvedHeaders instanceof Headers
						? Object.fromEntries(resolvedHeaders)
						: resolvedHeaders;

				// user is expected to specify user-agent and origin
				// both are in spec

				requestHeaders['Host'] = (remote as URL).host;
				// requestHeaders['Origin'] = origin;
				requestHeaders['Pragma'] = 'no-cache';
				requestHeaders['Cache-Control'] = 'no-cache';
				requestHeaders['Upgrade'] = 'websocket';
				// requestHeaders['User-Agent'] = navigator.userAgent;
				requestHeaders['Connection'] = 'Upgrade';

				return requestHeaders;
			},
			(meta) => {
				fakeProtocol = meta.protocol;
				if (onSetCookiesCallback) onSetCookiesCallback(meta.setCookies);
			},
			(readyState) => {
				fakeReadyState = readyState;
			},
			webSocketImpl
		);

		// protocol is always an empty before connecting
		// updated when we receive the metadata
		// this value doesn't change when it's CLOSING or CLOSED etc
		let fakeProtocol = '';

		let fakeReadyState: number = WebSocketFields.CONNECTING;

		const getReadyState = () => {
			const realReadyState = getRealReadyState.call(socket);
			// readyState should only be faked when the real readyState is OPEN
			return realReadyState === WebSocketFields.OPEN
				? fakeReadyState
				: realReadyState;
		};

		if (readyStateHook) readyStateHook(socket, getReadyState);
		else {
			// we have to hook .readyState ourselves

			Object.defineProperty(socket, 'readyState', {
				get: getReadyState,
				configurable: true,
				enumerable: true,
			});
		}

		/**
		 * @returns The error that should be thrown if send() were to be called on this socket according to the fake readyState value
		 */
		const getSendError = () => {
			const readyState = getReadyState();

			if (readyState === WebSocketFields.CONNECTING)
				return new DOMException(
					"Failed to execute 'send' on 'WebSocket': Still in CONNECTING state."
				);
		};

		if (sendHook) sendHook(socket, getSendError);
		else {
			// we have to hook .send ourselves
			socket.send = function (data) {
				const error = getSendError();

				if (error) throw error;
				else WebSocketFields.prototype.send.call(this, data);
			};
		}

		if (urlHook) urlHook(socket, remote);
		else
			Object.defineProperty(socket, 'url', {
				get: () => remote.toString(),
				configurable: true,
				enumerable: true,
			});

		const getProtocol = () => fakeProtocol;

		if (protocolHook) protocolHook(socket, getProtocol);
		else
			Object.defineProperty(socket, 'protocol', {
				get: getProtocol,
				configurable: true,
				enumerable: true,
			});

		return socket;
	}

	async fetch(
		url: urlLike | Request,
		init?: RequestInit
	): Promise<BareResponseFetch> {
		const req = isUrlLike(url) ? new Request(url, init) : url;

		// try to use init.headers because it may contain capitalized headers
		// furthermore, important headers on the Request class are blocked...
		// we should try to preserve the capitalization due to quirks with earlier servers
		const inputHeaders = init?.headers || req.headers;

		const headers: BareHeaders =
			inputHeaders instanceof Headers
				? Object.fromEntries(inputHeaders)
				: (inputHeaders as BareHeaders);

		let urlO = new URL(req.url);

		const client = await this.demand();

		for (let i = 0; ; i++) {
			if ('host' in headers) headers.host = urlO.host;
			else headers.Host = urlO.host;

			const response: BareResponse & Partial<BareResponseFetch> =
				await client.request(
					req.method,
					headers,
					req.body,
					urlO,
					req.cache,
					req.signal
				);

			response.finalURL = urlO.toString();

			const redirect = init?.redirect || req.redirect;

			if (statusRedirect.includes(response.status)) {
				switch (redirect) {
					case 'follow': {
						const location = response.headers.get('location');
						if (maxRedirects > i && location !== null) {
							urlO = new URL(location, urlO);
							continue;
						} else throw new TypeError('Failed to fetch');
					}
					case 'error':
						throw new TypeError('Failed to fetch');
					case 'manual':
						return response as BareResponseFetch;
				}
			} else {
				return response as BareResponseFetch;
			}
		}
	}
}

function isUrlLike(url: unknown): url is urlLike {
	return typeof url === 'string' || url instanceof URL;
}
