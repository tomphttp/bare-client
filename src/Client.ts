import type {
	BareBodyInit,
	BareCache,
	BareHeaders,
	BareMethod,
	BareResponse,
	BareWebSocket,
	BareWebSocket2,
	XBare,
} from './BareTypes.js';

export const statusEmpty = [101, 204, 205, 304];
export const statusRedirect = [301, 302, 303, 307, 308];

export interface BareErrorBody {
	code: string;
	id: string;
	message?: string;
	stack?: string;
}

export class BareError extends Error {
	status: number;
	body: BareErrorBody;
	constructor(status: number, body: BareErrorBody) {
		super(body.message || body.code);
		this.status = status;
		this.body = body;
	}
}

export interface GenericClient {
	/**
	 * V1-V2
	 */
	legacyConnect(
		requestHeaders: BareHeaders,
		remote: URL
	): Promise<BareWebSocket>;
	/**
	 * V3+
	 */
	connect(requestHeaders: BareHeaders, remote: URL): BareWebSocket2;
	request(
		method: BareMethod,
		requestHeaders: BareHeaders,
		body: BareBodyInit,
		remote: URL,
		cache: BareCache | undefined,
		signal: AbortSignal | undefined
	): Promise<BareResponse>;
}

export class Client {
	protected base: URL;
	/**
	 *
	 * @param version Version provided by extension
	 * @param server Bare Server URL provided by BareClient
	 */
	constructor(version: number, server: URL) {
		this.base = new URL(`./v${version}/`, server);
	}
}

export class LegacyClient extends Client {
	connect(): BareWebSocket2 {
		throw new Error('Not supported');
	}
}

export class ModernClient<T extends GenericClient> extends Client {
	async legacyConnect(
		requestHeaders: BareHeaders,
		remote: URL
	): Promise<BareWebSocket> {
		const modern: WebSocket & (BareWebSocket | BareWebSocket2) = (
			this as unknown as T
		).connect(requestHeaders, remote);

		// downgrade the meta
		(modern as unknown as BareWebSocket).meta = (
			modern as BareWebSocket2
		).meta.then(() => {
			const fakeHeaders: BareHeaders = {
				'sec-websocket-protocol': modern.protocol,
				'sec-websocket-extensions': modern.extensions,
			};

			return {
				status: 101,
				statusText: 'Switching Protocols',
				headers: new Headers(fakeHeaders as HeadersInit),
				rawHeaders: fakeHeaders,
			} as XBare;
		});

		return modern as unknown as BareWebSocket;
	}
}
