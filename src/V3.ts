import type {
	BareBodyInit,
	BareCache,
	BareHeaders,
	BareHTTPProtocol,
	BareMethod,
	BareResponse,
	BareWSProtocol,
	BareWebSocket2,
	XBare,
} from './BareTypes.js';
import { BareError, ModernClient, statusEmpty } from './Client.js';
import type { GenericClient } from './Client.js';
import md5 from './md5.js';
import { remoteToURL } from './remoteUtil.js';
import { joinHeaders, splitHeaders } from './splitHeaderUtil.js';

type SocketClientToServer = {
	type: 'connect';
	to: string;
	headers: BareHeaders;
	forwardHeaders: string[];
};

type SocketServerToClient = {
	type: 'open';
	protocol: string;
};

export default class ClientV3
	extends ModernClient<ClientV3>
	implements GenericClient
{
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
		requestHeaders: BareHeaders,
		protocol: BareWSProtocol,
		host: string,
		port: string | number,
		path: string
	) {
		const ws: WebSocket & Partial<BareWebSocket2> = new WebSocket(this.ws);

		ws.meta = new Promise((resolve, reject) => {
			const cleanup = () => {
				ws.removeEventListener('close', closeListener);
				ws.removeEventListener('message', messageListener);
			};

			const closeListener = () => {
				reject('WebSocket closed before handshake could be completed');
				cleanup();
			};

			const messageListener = (event: MessageEvent) => {
				cleanup();

				// ws.binaryType is irrelevant when sending text
				if (typeof event.data !== 'string')
					throw new TypeError(
						'the first websocket message was not a text frame'
					);

				const message = JSON.parse(event.data) as SocketServerToClient;

				// finally
				if (message.type !== 'open')
					throw new TypeError('message was not of open type');

				ws.dispatchEvent(new Event('open'));

				event.stopImmediatePropagation();

				// TODO: allow passing a function that is called in place of Object.defineProperty to lay the hook on this websocket in particular
				Object.defineProperty(WebSocket.prototype, 'protocol', {
					get: () => message.protocol,
					configurable: true, // let the client undefine it if it doesn't like how we set it
					enumerable: true,
				});

				resolve({
					protocol: message.protocol,
				});
			};

			ws.addEventListener('close', closeListener);
			ws.addEventListener('message', messageListener);
		});

		ws.addEventListener(
			'open',
			(event) => {
				// we need to send our real "open" event
				event.stopImmediatePropagation();

				ws.send(
					JSON.stringify({
						type: 'connect',
						to: remoteToURL({
							protocol,
							host,
							port: Number(port),
							path,
						}).toString(),
						headers: requestHeaders,
						forwardHeaders: [],
					} as SocketClientToServer)
				);
			},
			// only block the open event once
			{ once: true }
		);

		return ws as BareWebSocket2;
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
		if (protocol.startsWith('blob:')) {
			const response = await fetch(`${protocol}${host}${path}`);
			const result: Response & Partial<BareResponse> = new Response(
				response.body,
				response
			);

			result.rawHeaders = Object.fromEntries(response.headers);
			result.rawResponse = response;

			return <BareResponse>result;
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
			options.cache = <RequestCache>cache;
		}

		if (body !== undefined) {
			options.body = body;
		}

		options.headers = this.createBareHeaders(
			protocol,
			host,
			path,
			port,
			bareHeaders
		);

		const request = new Request(
			this.http + '?cache=' + md5(`${protocol}${host}${port}${path}`),
			options
		);

		const response = await fetch(request);

		const readResponse = await this.readBareResponse(response);

		const result: Response & Partial<BareResponse> = new Response(
			statusEmpty.includes(readResponse.status!) ? undefined : response.body,
			{
				status: readResponse.status!,
				statusText: readResponse.statusText ?? undefined,
				headers: readResponse.headers!,
			}
		);

		result.rawHeaders = readResponse.rawHeaders;
		result.rawResponse = response;

		return <BareResponse>result;
	}
	private async readBareResponse(response: Response): Promise<XBare> {
		if (!response.ok) {
			throw new BareError(response.status, await response.json());
		}

		const responseHeaders = joinHeaders(response.headers);

		const result: XBare = {};

		if (responseHeaders.has('x-bare-status')) {
			result.status = parseInt(responseHeaders.get('x-bare-status')!);
		}

		if (responseHeaders.has('x-bare-status-text')) {
			result.statusText = responseHeaders.get('x-bare-status-text')!;
		}

		if (responseHeaders.has('x-bare-headers')) {
			result.rawHeaders = JSON.parse(responseHeaders.get('x-bare-headers')!);
			result.headers = new Headers(<HeadersInit>result.rawHeaders);
		}

		return result;
	}
	createBareHeaders(
		protocol: BareWSProtocol | BareHTTPProtocol,
		host: string,
		path: string,
		port: number | string,
		bareHeaders: BareHeaders,
		forwardHeaders: string[] = [],
		passHeaders: string[] = [],
		passStatus: number[] = []
	) {
		const headers = new Headers();

		headers.set('x-bare-protocol', protocol);
		headers.set('x-bare-host', host);
		headers.set('x-bare-path', path);
		headers.set('x-bare-port', port.toString());
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
