import type {
	BareBodyInit,
	BareCache,
	BareHeaders,
	BareHTTPProtocol,
	BareManifest,
	BareMethod,
	BareResponse,
	BareResponseFetch,
	BareWebSocket,
	BareWSProtocol,
	urlLike,
} from './BareTypes';
import { maxRedirects } from './BareTypes';
import type { GenericClient } from './Client';
import { statusRedirect } from './Client';
import ClientV1 from './V1';
import ClientV2 from './V2';
import { validProtocol } from './encodeProtocol';

// Implements the protocol for requesting bare data from a server
// See ../Server/Send.mjs

export * from './Client';

const clientCtors: [string, { new (server: URL): GenericClient }][] = [
	['v2', ClientV2],
	['v1', ClientV1],
];

async function fetchManifest(
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

function resolvePort(url: URL) {
	if (url.port) return Number(url.port);

	switch (url.protocol) {
		case 'ws:':
		case 'http:':
			return 80;
		case 'wss:':
		case 'https:':
			return 443;
		default:
			// maybe blob
			return 0;
	}
}

export default class BareClient {
	/**
	 * @depricated Use .manifest instead.
	 */
	get data(): BareClient['manfiest'] {
		return this.manfiest;
	}
	manfiest?: BareManifest;
	private client?: GenericClient;
	private server: URL;
	private working?: Promise<void>;
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
			this.manfiest = _;
			this.getClient();
		}
	}
	private demand() {
		if (!this.onDemand) return;

		if (!this.working)
			this.working = fetchManifest(this.server, this.onDemandSignal)
				.then((manfiest) => {
					this.manfiest = manfiest;
					this.getClient();
				})
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
		for (const [version, ctor] of clientCtors) {
			if (this.data!.versions.includes(version)) {
				this.client = new ctor(this.server);
				return;
			}
		}

		throw new Error(`Unable to find compatible client version.`);
	}
	async request(
		method: BareMethod,
		requestHeaders: BareHeaders,
		body: BareBodyInit,
		protocol: BareHTTPProtocol,
		host: string,
		port: string | number,
		path: string,
		cache: BareCache | undefined,
		signal: AbortSignal | undefined
	): Promise<BareResponse> {
		await this.demand();

		return await this.client!.request(
			method,
			requestHeaders,
			body,
			protocol,
			host,
			port,
			path,
			cache,
			signal
		);
	}
	async connect(
		requestHeaders: BareHeaders,
		protocol: BareWSProtocol,
		host: string,
		port: string | number,
		path: string
	): Promise<BareWebSocket> {
		await this.demand();

		return this.client!.connect(requestHeaders, protocol, host, port, path);
	}
	/**
	 *
	 * @param url
	 * @param headers
	 * @param protocols
	 * @returns
	 */
	createWebSocket(
		url: urlLike,
		headers: BareHeaders | Headers = {},
		protocols: string | string[] = []
	): Promise<BareWebSocket> {
		const requestHeaders: BareHeaders =
			headers instanceof Headers ? Object.fromEntries(headers) : headers;

		url = new URL(url);

		// user is expected to specify user-agent and origin
		// both are in spec

		requestHeaders['Host'] = url.host;
		// requestHeaders['Origin'] = origin;
		requestHeaders['Pragma'] = 'no-cache';
		requestHeaders['Cache-Control'] = 'no-cache';
		requestHeaders['Upgrade'] = 'websocket';
		// requestHeaders['User-Agent'] = navigator.userAgent;
		requestHeaders['Connection'] = 'Upgrade';

		if (typeof protocols === 'string') {
			protocols = [protocols];
		}

		for (const proto of protocols) {
			if (!validProtocol(proto)) {
				throw new DOMException(
					`Failed to construct 'WebSocket': The subprotocol '${proto}' is invalid.`
				);
			}
		}

		if (protocols.length)
			requestHeaders['Sec-Websocket-Protocol'] = protocols.join(', ');

		return this.connect(
			requestHeaders,
			url.protocol,
			url.hostname,
			resolvePort(url),
			url.pathname + url.search
		);
	}
	async fetch(
		url: urlLike | Request,
		init?: RequestInit
	): Promise<BareResponseFetch> {
		const req = isUrlLike(url) ? new Request(url, init) : url;

		/*
		const a = new Headers(); // unmanaged `Headers`
		const b = new Request(location.toString()).headers; // managed `Headers`


		a.set("user-agent", "test");
		b.set("user-agent", "test");

		// On Chrome: "test" null
		console.log(a.get("user-agent"), b.get("user-agent"))
		*/

		// try to use init.headers because it may contain capitalized headers
		// furthermore, important headers on the Request class are blocked...
		// we should try to preserve the capitalization due to quirks with earlier servers
		const inputHeaders = init?.headers || req.headers;

		const headers: BareHeaders =
			inputHeaders instanceof Headers
				? Object.fromEntries(inputHeaders)
				: (inputHeaders as BareHeaders);

		let urlO = new URL(req.url);

		for (let i = 0; ; i++) {
			if ('host' in headers) headers.host = urlO.host;
			else headers.Host = urlO.host;

			const response: BareResponse & Partial<BareResponseFetch> =
				await this.request(
					req.method,
					headers,
					req.body,
					urlO.protocol,
					urlO.hostname,
					resolvePort(urlO),
					urlO.pathname + urlO.search,
					req.cache,
					req.signal
				);

			response.finalURL = url.toString();

			if (statusRedirect.includes(response.status)) {
				switch (req.redirect) {
					case 'follow':
						if (maxRedirects > i && response.headers.has('location')) {
							urlO = new URL(response.headers.get('location')!, urlO);
							continue;
						} else {
							throw new TypeError('Failed to fetch');
						}
					case 'error':
						throw new TypeError('Failed to fetch');
					case 'manual':
						return <BareResponseFetch>response;
				}
			} else {
				return <BareResponseFetch>response;
			}
		}
	}
}

function isUrlLike(url: unknown): url is urlLike {
	return typeof url === 'string' || url instanceof URL;
}

/**
 *
 * Facilitates fetching the Bare server and constructing a BareClient.
 * @param server Bare server
 * @param signal Abort signal when fetching the manifest
 */
export async function createBareClient(
	server: string | URL,
	signal?: AbortSignal
): Promise<BareClient> {
	const manfiest = await fetchManifest(server, signal);

	return new BareClient(server, manfiest);
}
