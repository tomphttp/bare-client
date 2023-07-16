import type {
	BareCache,
	BareHeaders,
	BareMethod,
	BareResponse,
	BareWebSocketMeta,
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

export type MetaCallback = (meta: BareWebSocketMeta) => void;
export type ReadyStateCallback = (readyState: number) => void;
export type WebSocketImpl = {
	new (...args: ConstructorParameters<typeof WebSocket>): WebSocket;
};
export type GetRequestHeadersCallback = () => Promise<BareHeaders>;

export abstract class Client {
	abstract connect(
		remote: URL,
		protocols: string[],
		getRequestHeaders: GetRequestHeadersCallback,
		onMeta: MetaCallback,
		onReadyState: ReadyStateCallback,
		webSocketImpl: WebSocketImpl
	): WebSocket;
	abstract request(
		method: BareMethod,
		requestHeaders: BareHeaders,
		body: BodyInit | null,
		remote: URL,
		cache: BareCache | undefined,
		duplex: string | undefined,
		signal: AbortSignal | undefined
	): Promise<BareResponse>;
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
