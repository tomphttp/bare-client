import { createBareClient } from '@tomphttp/bare-client';

/**
 * Fetch the manifest so client.fetch will be ready to execute immediately.
 */
const client = await createBareClient('https://uv.holyubofficial.net/');

const response = await client.fetch('https://www.google.com/');

console.log(response.status, await response.text());
