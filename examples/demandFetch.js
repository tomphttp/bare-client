import BareClient from '@tomphttp/bare-client';

const client = new BareClient('https://uv.holyubofficial.net/');

setTimeout(async () => {
	// only now will the BareClient request the manifest
	const response = await client.fetch('https://www.google.com/');

	console.log(response.status, await response.text());

	// 2nd call will reuse the first manifest
	await client.fetch('https://www.google.com/');
}, 1000);
