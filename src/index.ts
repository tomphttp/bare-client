import { BareClient, fetchManifest } from './BareClient';

export { BareClient };

export * from './Client';

/**
 *
 * Facilitates fetching the Bare server and constructing a BareClient.
 * @param server Bare server
 * @param signal Abort signal when fetching the manifest
 */
export async function createBareClient(
	server: string | URL,
	signal?: AbortSignal
): Promise<BareClient> {
	const manfiest = await fetchManifest(server, signal);

	return new BareClient(server, manfiest);
}
