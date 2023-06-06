/*
 * Utilities for converting remotes to URLs
 */

export interface BareRemote {
	host: string;
	port: number | string;
	path: string;
	protocol: string;
}

export function remoteToURL(remote: BareRemote) {
	return new URL(
		`${remote.protocol}${remote.host}:${remote.port}${remote.path}`
	);
}
