import {
	BareBodyInit,
	BareCache,
	BareHeaders,
	BareHTTPProtocol,
	BareMethod,
	BareResponse,
	BareWebSocket,
	BareWSProtocol,
	XBare,
} from './BareClient.js';
import Client, { BareError, GenericClient, statusEmpty } from './Client.js';
import { encodeProtocol } from './encodeProtocol.js';

export default class ClientV1 extends Client implements GenericClient {
	ws: URL;
	http: URL;
	newMeta: URL;
	getMeta: URL;
	constructor(server: URL) {
		super(1, server);

		this.ws = new URL(this.base);
		this.http = new URL(this.base);
		this.newMeta = new URL('ws-new-meta', this.base);
		this.getMeta = new URL('ws-meta', this.base);

		if (this.ws.protocol === 'https:') {
			this.ws.protocol = 'wss:';
		} else {
			this.ws.protocol = 'ws:';
		}
	}
	async connect(
		requestHeaders: BareHeaders,
		protocol: BareWSProtocol,
		host: string,
		port: string | number,
		path: string
	): Promise<BareWebSocket> {
		const assignMeta = await fetch(this.newMeta, { method: 'GET' });

		if (!assignMeta.ok) {
			throw new BareError(assignMeta.status, await assignMeta.json());
		}

		const id = await assignMeta.text();

		const socket: WebSocket & Partial<BareWebSocket> = new WebSocket(this.ws, [
			'bare',
			encodeProtocol(
				JSON.stringify({
					remote: {
						protocol,
						host,
						port,
						path,
					},
					headers: requestHeaders,
					forward_headers: [
						'accept-encoding',
						'accept-language',
						'sec-websocket-extensions',
						'sec-websocket-key',
						'sec-websocket-version',
					],
					id,
				})
			),
		]);

		socket.meta = new Promise<XBare>((resolve, reject) => {
			socket.addEventListener('open', async () => {
				const outgoing = await fetch(this.getMeta, {
					headers: {
						'x-bare-id': id,
					},
					method: 'GET',
				});

				if (!outgoing.ok) {
					reject(new BareError(outgoing.status, await outgoing.json()));
				}

				resolve(await outgoing.json());
			});

			socket.addEventListener('error', reject);
		});

		return <BareWebSocket>socket;
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
			const response = await fetch(`blob:${location.origin}${path}`);
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

		const forwardHeaders = ['accept-encoding', 'accept-language'];

		const options: RequestInit = {
			credentials: 'include',
			method: method,
			signal,
		};

		if (body !== undefined) {
			options.body = body;
		}

		// bare can be an absolute path containing no origin, it becomes relative to the script
		const request = new Request(this.http, options);

		this.writeBareRequest(
			request,
			protocol,
			host,
			path,
			port,
			bareHeaders,
			forwardHeaders
		);

		const response = await fetch(request);

		const readResponse = await this.readBareResponse(response);

		const result: Partial<BareResponse> = new Response(
			statusEmpty.includes(readResponse.status) ? undefined : response.body,
			{
				status: readResponse.status,
				statusText: readResponse.statusText ?? undefined,
				headers: readResponse.headers,
			}
		);

		result.rawHeaders = readResponse.rawHeaders;
		result.rawResponse = response;

		return <BareResponse>result;
	}
	private async readBareResponse(response: Response) {
		if (!response.ok) {
			throw new BareError(response.status, await response.json());
		}

		const requiredHeaders = [
			'x-bare-status',
			'x-bare-status-text',
			'x-bare-headers',
		];

		for (const header of requiredHeaders) {
			if (!response.headers.has(header)) {
				throw new BareError(500, {
					code: 'IMPL_MISSING_BARE_HEADER',
					id: `response.headers.${header}`,
				});
			}
		}

		const status = parseInt(response.headers.get('x-bare-status')!);
		const statusText = response.headers.get('x-bare-status-text')!;
		const rawHeaders = JSON.parse(response.headers.get('x-bare-headers')!);
		const headers = new Headers(rawHeaders);

		return {
			status,
			statusText,
			rawHeaders,
			headers,
		};
	}
	private writeBareRequest(
		request: Request,
		protocol: BareHTTPProtocol,
		host: string,
		path: string,
		port: string | number,
		bareHeaders: BareHeaders,
		forwardHeaders: string[]
	) {
		request.headers.set('x-bare-protocol', protocol);
		request.headers.set('x-bare-host', host);
		request.headers.set('x-bare-path', path);
		request.headers.set('x-bare-port', port.toString());
		request.headers.set('x-bare-headers', JSON.stringify(bareHeaders));
		request.headers.set(
			'x-bare-forward-headers',
			JSON.stringify(forwardHeaders)
		);
	}
}
