// The user likely has overwritten all networking functions after importing bare-client
// It is our responsibility to make sure components of Bare-Client are using native networking functions

// These exports are provided to plugins by @rollup/plugin-inject

export const fetch = global.fetch;
export const WebSocket = global.WebSocket;
export const Request = global.Request;
export const Response = global.Response;
export const XMLHttpRequest = global.XMLHttpRequest;
