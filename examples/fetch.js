import { createBareClient } from '@tomphttp/bare-client';

const client = await createBareClient('https://uv.holyubofficial.net/');

const response = await client.fetch('https://www.google.com/');

console.log(response.status, await response.text());
