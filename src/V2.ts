import type {
	BareBodyInit,
	BareCache,
	BareHeaders,
	BareHTTPProtocol,
	BareMethod,
	BareResponse,
	BareWebSocket,
	BareWSProtocol,
	XBare,
} from './BareClient';
import type { GenericClient} from './Client';
import Client, { BareError, statusEmpty } from './Client';
import md5 from './md5';
import { joinHeaders, splitHeaders } from './splitHeaderUtil';

export default class ClientV2 extends Client implements GenericClient {
	ws: URL;
	http: URL;
	newMeta: URL;
	getMeta: URL;
	constructor(server: URL) {
		super(2, server);

		this.ws = new URL(this.base);
		this.http = new URL(this.base);
		this.newMeta = new URL('./ws-new-meta', this.base);
		this.getMeta = new URL(`./ws-meta`, this.base);

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
		const request = new Request(this.newMeta, {
			headers: this.createBareHeaders(
				protocol,
				host,
				path,
				port,
				requestHeaders
			),
		});

		const assign_meta = await fetch(request);

		if (!assign_meta.ok) {
			throw new BareError(assign_meta.status, await assign_meta.json());
		}

		const id = await assign_meta.text();

		const socket: WebSocket & Partial<BareWebSocket> = new WebSocket(this.ws, [
			id,
		]);

		socket.meta = new Promise<XBare>((resolve, reject) => {
			socket.addEventListener('open', async () => {
				const outgoing = await fetch(this.getMeta, {
					headers: {
						'x-bare-id': id,
					},
					method: 'GET',
				});

				resolve(await await this.readBareResponse(outgoing));
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

		const options: RequestInit = {
			credentials: 'omit',
			method: method,
			signal,
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
