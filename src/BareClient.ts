import type {
	BareBodyInit,
	BareCache,
	BareHeaders,
	BareManifest,
	BareMethod,
	BareResponse,
	BareResponseFetch,
	BareWebSocket,
	urlLike,
} from './BareTypes';
import { maxRedirects } from './BareTypes';
import type { GenericClient } from './Client';
import { statusRedirect } from './Client';
import ClientV3 from './V3';
import { validProtocol } from './encodeProtocol';

const clientCtors: [string, { new (server: URL): GenericClient }][] = [
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

export class BareClient {
	manfiest?: BareManifest;
	private client?: GenericClient;
	private server: URL;
	private working?: Promise<GenericClient>;
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
			this.client = this.getClient();
		}
	}
	private demand() {
		if (!this.onDemand) return this.client!;

		if (!this.working)
			this.working = fetchManifest(this.server, this.onDemandSignal)
				.then((manfiest) => {
					this.manfiest = manfiest;
					this.client = this.getClient();
					return this.client;
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
		for (const [version, ctor] of clientCtors)
			if (this.manfiest!.versions.includes(version))
				return new ctor(this.server);

		throw new Error(`Unable to find compatible client version.`);
	}
	async request(
		method: BareMethod,
		requestHeaders: BareHeaders,
		body: BareBodyInit,
		remote: URL,
		cache: BareCache | undefined,
		signal: AbortSignal | undefined
	): Promise<BareResponse> {
		const client = await this.demand();

		return await client.request(
			method,
			requestHeaders,
			body,
			remote,
			cache,
			signal
		);
	}
	connect(
		requestHeaders: BareHeaders,
		remote: URL,
		protocols: string[]
	): BareWebSocket {
		if (!this.client)
			throw new TypeError(
				'You need to wait for the client to finish fetching the manifest before creating any WebSockets. Try caching the manifest data before making this request.'
			);
		return this.client.connect(requestHeaders, remote, protocols);
	}
	createWebSocket(
		remote: urlLike,
		headers: BareHeaders | Headers | undefined = {},
		protocols: string | string[] = []
	): WebSocket {
		if (!this.client)
			throw new TypeError(
				'You need to wait for the client to finish fetching the manifest before creating any WebSockets. Try caching the manifest data before making this request.'
			);

		const requestHeaders: BareHeaders =
			headers instanceof Headers ? Object.fromEntries(headers) : headers;

		remote = new URL(remote);

		// user is expected to specify user-agent and origin
		// both are in spec

		requestHeaders['Host'] = remote.host;
		// requestHeaders['Origin'] = origin;
		requestHeaders['Pragma'] = 'no-cache';
		requestHeaders['Cache-Control'] = 'no-cache';
		requestHeaders['Upgrade'] = 'websocket';
		// requestHeaders['User-Agent'] = navigator.userAgent;
		requestHeaders['Connection'] = 'Upgrade';

		if (typeof protocols === 'string') protocols = [protocols];

		for (const proto of protocols)
			if (!validProtocol(proto))
				throw new DOMException(
					`Failed to construct 'WebSocket': The subprotocol '${proto}' is invalid.`
				);

		return this.client.connect(requestHeaders, remote, protocols);
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

		for (let i = 0; ; i++) {
			if ('host' in headers) headers.host = urlO.host;
			else headers.Host = urlO.host;

			const response: BareResponse & Partial<BareResponseFetch> =
				await this.request(
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
