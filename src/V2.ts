import type {
	BareBodyInit,
	BareCache,
	BareHeaders,
	BareMethod,
	BareResponse,
	BareWebSocket,
	XBare,
} from './BareTypes.js';
import { BareError, LegacyClient, statusEmpty } from './Client.js';
import type { GenericClient } from './Client.js';
import md5 from './md5.js';
import { urlToRemote } from './remoteUtil.js';
import { joinHeaders, splitHeaders } from './splitHeaderUtil.js';

export default class ClientV2 extends LegacyClient implements GenericClient {
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
	async legacyConnect(
		requestHeaders: BareHeaders,
		remote: URL
	): Promise<BareWebSocket> {
		const request = new Request(this.newMeta, {
			headers: this.createBareHeaders(remote, requestHeaders),
		});

		const assignMeta = await fetch(request);

		if (!assignMeta.ok) {
			throw new BareError(assignMeta.status, await assignMeta.json());
		}

		const id = await assignMeta.text();

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

				resolve(await this.readBareResponse(outgoing));
			});

			socket.addEventListener('error', reject);
		});

		return socket as BareWebSocket;
	}
	async request(
		method: BareMethod,
		requestHeaders: BareHeaders,
		body: BareBodyInit,
		remote: URL,
		cache: BareCache | undefined,
		signal: AbortSignal | undefined
	): Promise<BareResponse> {
		if (remote.protocol === 'blob:') {
			const response = await fetch(remote);
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
		remote: URL,
		bareHeaders: BareHeaders,
		forwardHeaders: string[] = [],
		passHeaders: string[] = [],
		passStatus: number[] = []
	) {
		const headers = new Headers();

		const bareRemote = urlToRemote(remote);

		headers.set('x-bare-protocol', bareRemote.protocol);
		headers.set('x-bare-host', bareRemote.host);
		headers.set('x-bare-path', bareRemote.path);
		headers.set('x-bare-port', bareRemote.port.toString());
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
