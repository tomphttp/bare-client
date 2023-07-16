/* eslint-disable @typescript-eslint/no-explicit-any */
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

export interface BareWebSocketMeta {
	protocol: string;
	setCookies: string[];
}

export type BareHTTPProtocol = 'blob:' | 'http:' | 'https:' | string;
export type BareWSProtocol = 'ws:' | 'wss:' | string;

export const maxRedirects = 20;

export type BareHeaders = Record<string, string | string[]>;

/**
 * A Response with additional properties.
 */
export interface BareResponse extends Response {
	rawResponse: Response;
	rawHeaders: BareHeaders;
}

/**
 * A BareResponse with additional properties.
 */
export interface BareResponseFetch extends BareResponse {
	finalURL: string;
}

export interface BareMaintainer {
	email?: string;
	website?: string;
}

export interface BareProject {
	name?: string;
	description?: string;
	email?: string;
	website?: string;
	repository?: string;
	version?: string;
}

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

export interface BareManifest {
	maintainer?: BareMaintainer;
	project?: BareProject;
	versions: string[];
	language: BareLanguage;
	memoryUsage?: number;
}
