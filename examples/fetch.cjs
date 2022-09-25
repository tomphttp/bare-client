/* eslint-disable @typescript-eslint/no-var-requires */
const createBareClient = require('@tomphttp/bare-client');

createBareClient('https://uv.holyubofficial.net/').then(async (client) => {
	const response = await client.fetch('https://www.google.com/');

	console.log(response.status, await response.text());
});
