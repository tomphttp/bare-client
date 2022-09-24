import type {
	BareBodyInit,
	BareCache,
	BareHeaders,
	BareHTTPProtocol,
	BareMethod,
	BareResponse,
	BareWebSocket,
	BareWSProtocol,
} from './BareClient';

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
	connect(
		requestHeaders: BareHeaders,
		protocol: BareWSProtocol,
		host: string,
		port: string | number,
		path: string
	): Promise<BareWebSocket>;
	request(
		method: BareMethod,
		requestHeaders: BareHeaders,
		body: BareBodyInit,
		protocol: BareHTTPProtocol,
		host: string,
		port: string | number,
		path: string,
		cache: BareCache | undefined,
		signal: AbortSignal | undefined
	): Promise<BareResponse>;
}

export default class Client {
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
