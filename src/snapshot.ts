// The user likely has overwritten all networking functions after importing bare-client
// It is our responsibility to make sure components of Bare-Client are using native networking functions

// These exports are provided to plugins by @rollup/plugin-inject

export const fetch = globalThis.fetch;
export const WebSocket = globalThis.WebSocket;
export const Request = globalThis.Request;
export const Response = globalThis.Response;
export const XMLHttpRequest = globalThis.XMLHttpRequest;
