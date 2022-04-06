// Implements the protocol for requesting bare data from a server
// See ../Server/Send.mjs

export * from './Client.js';
import ClientV1 from './V1.js';
import ClientV2 from './V2.js';

/**
 * @typedef {object} BareMeta
 * @property {object} headers
 */

/**
 * @description WebSocket with an additional property.
 * @typedef {object} BareWebSocket
 * @property {Promise<BareMeta>} meta
 */

/**
 * @description A Response with additional properties.
 * @typedef {object} BareResponse
 * @property {object} rawHeaders
 */

/**
 * @typedef {object} BareFetchInit
 */

export default class BareClient {
	ready = false;
	/**
	 *
	 * @param {string|URL} server - A full URL to theb are server.
	 * @param {object} [data] - The a copy of the Bare server data found in BareClient.data. If specified, this data will be loaded. Otherwise, a request will be made to the bare server (upon fetching or creating a WebSocket).
	 */
	constructor(server, data) {
		this.server = new URL(server);

		if (typeof data === 'object') {
			this.#loadData(data);
		}
	}
	#loadData(data) {
		let found = false;

		// newest-oldest
		for (let constructor of [ClientV2, ClientV1]) {
			if (data.versions.includes(`v${constructor.version}`)) {
				this.client = new constructor(this);
				found = true;
				break;
			}
		}

		if (!found) {
			throw new Error(`Unable to find compatible client version.`);
		}

		this.data = data;
		this.ready = true;
	}
	async #work() {
		if (this.ready === true) {
			return;
		}

		const outgoing = await fetch(this.server);

		if (!outgoing.ok) {
			throw new Error(
				`Unable to fetch Bare meta: ${outgoing.status} ${await outgoing.text()}`
			);
		}

		this.#loadData(await outgoing.json());
	}
	/**
	 *
	 * @param {'GET'|'POST'|'DELETE'|'OPTIONS'|'PUT'|'PATCH'|'UPDATE'} method
	 * @param {object} request_headers
	 * @param {Blob|BufferSource|FormData|URLSearchParams|ReadableStream} body
	 * @param {'http:'|'https:'} protocol
	 * @param {string} host
	 * @param {string|number} port
	 * @param {string} path
	 * @param {'default'|'no-store'|'reload'|'no-cache'|'force-cache'|'only-if-cached'} cache
	 * @returns {BareResponse}
	 */
	async request(...args) {
		await this.#work();
		return this.client.request(...args);
	}
	/**
	 *
	 * @param {object} request_headers
	 * @param {'ws:'|'wss:'} protocol
	 * @param {string} host
	 * @param {string|number} port
	 * @param {string} path
	 * @returns {BareWebSocket}
	 */
	async connect(...args) {
		await this.#work();
		return this.client.connect(...args);
	}
	/**
	 *
	 * @param {URL} url
	 * @param {BareFetchInit} init
	 * @returns {BareResponse}
	 */
	async fetch(url, init) {
		url = new URL(url);
	}
}
