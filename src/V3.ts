import type {
	BareBodyInit,
	BareCache,
	BareHeaders,
	BareMethod,
	BareResponse,
	BareWebSocket,
} from './BareTypes.js';
import { BareError, Client, statusEmpty } from './Client.js';
import type { ReadyStateCallback, MetaCallback } from './Client.js';
import type {
	BareResponseHeaders,
	SocketClientToServer,
	SocketServerToClient,
} from './V3Types.js';
import md5 from './md5.js';
import { WebSocketFields } from './snapshot.js';
import { joinHeaders, splitHeaders } from './splitHeaderUtil.js';

export default class ClientV3 extends Client {
	ws: URL;
	http: URL;
	constructor(server: URL) {
		super(3, server);

		this.ws = new URL(this.base);
		this.http = new URL(this.base);

		if (this.ws.protocol === 'https:') {
			this.ws.protocol = 'wss:';
		} else {
			this.ws.protocol = 'ws:';
		}
	}
	connect(
		remote: URL,
		protocols: string[],
		requestHeaders: BareHeaders,
		onMeta: MetaCallback,
		onReadyState: ReadyStateCallback
	) {
		const ws: WebSocket & Partial<BareWebSocket> = new WebSocket(this.ws);

		const cleanup = () => {
			ws.removeEventListener('close', closeListener);
			ws.removeEventListener('message', messageListener);
		};

		const closeListener = () => {
			cleanup();
		};

		const messageListener = (event: MessageEvent) => {
			cleanup();

			// ws.binaryType is irrelevant when sending text
			if (typeof event.data !== 'string')
				throw new TypeError('the first websocket message was not a text frame');

			const message = JSON.parse(event.data) as SocketServerToClient;

			// finally
			if (message.type !== 'open')
				throw new TypeError('message was not of open type');

			event.stopImmediatePropagation();

			onMeta({
				protocol: message.protocol,
				setCookies: message.setCookies,
			});

			// now we want the client to see the websocket is open and ready to communicate with the remote
			onReadyState(WebSocket.OPEN);

			ws.dispatchEvent(new Event('open'));
		};

		ws.addEventListener('close', closeListener);
		ws.addEventListener('message', messageListener);

		// CONNECTED TO THE BARE SERVER, NOT THE REMOTE
		ws.addEventListener(
			'open',
			(event) => {
				// we have to cancel this event because it doesn't reflect the connection to the remote
				// once we are actually connected to the remote, we can dispatch a fake open event.
				event.stopImmediatePropagation();

				// we need to fake the readyState value again so it remains CONNECTING
				// right now, it's open because we just connected to the remote
				// but we need to fake this from the client so it thinks it's still connecting
				onReadyState(WebSocket.CONNECTING);

				WebSocketFields.prototype.send.call(
					ws,
					JSON.stringify({
						type: 'connect',
						remote: remote.toString(),
						protocols,
						headers: requestHeaders,
						forwardHeaders: [],
					} as SocketClientToServer)
				);
			},
			// only block the open event once
			{ once: true }
		);

		return ws as BareWebSocket;
	}
	async request(
		method: BareMethod,
		requestHeaders: BareHeaders,
		body: BareBodyInit,
		remote: URL,
		cache: BareCache | undefined,
		signal: AbortSignal | undefined
	): Promise<BareResponse> {
		if (remote.protocol.startsWith('blob:')) {
			const response = await fetch(remote);
			const result: Response & Partial<BareResponse> = new Response(
				response.body,
				response
			);

			result.rawHeaders = Object.fromEntries(response.headers);
			result.rawResponse = response;

			return result as BareResponse;
		}

		const bareHeaders: BareHeaders = {};

		if (requestHeaders instanceof Headers) {
			for (const [header, value] of requestHeaders) {
				bareHeaders[header] = value;
			}
		} else {
			for (const header in requestHeaders) {
				bareHeaders[header] = requestHeaders[header];
			}
		}

		const options: RequestInit = {
			credentials: 'omit',
			method: method,
			signal,
			// @ts-ignore
			duplex: 'half',
		};

		if (cache !== 'only-if-cached') {
			options.cache = cache as RequestCache;
		}

		if (body !== undefined) {
			options.body = body;
		}

		options.headers = this.createBareHeaders(remote, bareHeaders);

		const request = new Request(
			this.http + '?cache=' + md5(remote.toString()),
			options
		);

		const response = await fetch(request);

		const readResponse = await this.readBareResponse(response);

		const result: Response & Partial<BareResponse> = new Response(
			statusEmpty.includes(readResponse.status!) ? undefined : response.body,
			{
				status: readResponse.status,
				statusText: readResponse.statusText ?? undefined,
				headers: new Headers(readResponse.headers as HeadersInit),
			}
		);

		result.rawHeaders = readResponse.headers;
		result.rawResponse = response;

		return result as BareResponse;
	}
	private async readBareResponse(response: Response) {
		if (!response.ok) {
			throw new BareError(response.status, await response.json());
		}

		const responseHeaders = joinHeaders(response.headers);

		const result: Partial<BareResponseHeaders> = {};

		const xBareStatus = responseHeaders.get('x-bare-status');
		if (xBareStatus !== null) result.status = parseInt(xBareStatus);

		const xBareStatusText = responseHeaders.get('x-bare-status-text');
		if (xBareStatusText !== null) result.statusText = xBareStatusText;

		const xBareHeaders = responseHeaders.get('x-bare-headers');
		if (xBareHeaders !== null) result.headers = JSON.parse(xBareHeaders);

		return result as BareResponseHeaders;
	}
	createBareHeaders(
		remote: URL,
		bareHeaders: BareHeaders,
		forwardHeaders: string[] = [],
		passHeaders: string[] = [],
		passStatus: number[] = []
	) {
		const headers = new Headers();

		headers.set('x-bare-url', remote.toString());
		headers.set('x-bare-headers', JSON.stringify(bareHeaders));

		for (const header of forwardHeaders) {
			headers.append('x-bare-forward-headers', header);
		}

		for (const header of passHeaders) {
			headers.append('x-bare-pass-headers', header);
		}

		for (const status of passStatus) {
			headers.append('x-bare-pass-status', status.toString());
		}

		splitHeaders(headers);

		return headers;
	}
}
