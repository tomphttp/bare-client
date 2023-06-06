export type BareMethod =
	| 'GET'
	| 'POST'
	| 'DELETE'
	| 'OPTIONS'
	| 'PUT'
	| 'PATCH'
	| 'UPDATE'
	| string;

export type BareCache =
	| 'default'
	| 'no-store'
	| 'reload'
	| 'no-cache'
	| 'force-cache'
	| 'only-if-cached'
	| string;

export interface XBare {
	status: number;
	statusText: string;
	headers: Headers;
	rawHeaders: BareHeaders;
}

export interface XBare2 {
	protocol: string;
}

export type BareHTTPProtocol = 'blob:' | 'http:' | 'https:' | string;
export type BareWSProtocol = 'ws:' | 'wss:' | string;

export type urlLike = URL | string;

export const maxRedirects = 20;

export type BareHeaders = Record<string, string | string[]>;

/**
 * WebSocket with an additional property.
 */
export type BareWebSocket = WebSocket & { meta: Promise<XBare> };

/**
 * WebSocket with an additional property.
 */
export type BareWebSocket2 = WebSocket & { meta: Promise<XBare2> };

/**
 * A Response with additional properties.
 */
export type BareResponse = Response & {
	rawResponse: Response;
	rawHeaders: BareHeaders;
};

/**
 * A BareResponse with additional properties.
 */
export type BareResponseFetch = BareResponse & { finalURL: string };
export type BareBodyInit =
	| Blob
	| BufferSource
	| FormData
	| URLSearchParams
	| ReadableStream
	| undefined
	| null;

export type BareFetchInit = {
	method?: BareMethod;
	headers?: Headers | BareHeaders;
	body?: BareBodyInit;
	cache?: BareCache;
	redirect?: 'follow' | 'manual' | 'error' | string;
	signal?: AbortSignal;
};

export type BareMaintainer = {
	email?: string;
	website?: string;
};

export type BareProject = {
	name?: string;
	description?: string;
	email?: string;
	website?: string;
	repository?: string;
	version?: string;
};

export type BareLanguage =
	| 'NodeJS'
	| 'ServiceWorker'
	| 'Deno'
	| 'Java'
	| 'PHP'
	| 'Rust'
	| 'C'
	| 'C++'
	| 'C#'
	| 'Ruby'
	| 'Go'
	| 'Crystal'
	| 'Shell'
	| string;

export type BareManifest = {
	maintainer?: BareMaintainer;
	project?: BareProject;
	versions: string[];
	language: BareLanguage;
	memoryUsage?: number;
};
