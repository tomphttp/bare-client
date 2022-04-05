const valid_chars = "!#$%&'*+-.0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ^_`abcdefghijklmnopqrstuvwxyz|~";
const reserved_chars = "%";

class Tomp {
    constructor(bare = '/bare/') {
        this.bare = new URL(bare, location).href;
        this.v1 = new V1Client(this);
        this.emptyBody = {
            methods: ['GET', 'HEAD'],
            status: [204, 304]
        };
        this.server = null;
    };
    async ping() {
        const res = await fetch(this.bare);

        if (!res.ok) {
            this.server = false;
        } else {
            this.server = await res.json();
        };
    };
    encodeProtocol(protocol){
        protocol = protocol.toString();
    
        let result = '';
        
        for(let i = 0; i < protocol.length; i++){
            const char = protocol[i];
    
            if(valid_chars.includes(char) && !reserved_chars.includes(char)){
                result += char;
            }else{
                const code = char.charCodeAt();
                result += '%' + code.toString(16).padStart(2, 0);
            }
        }
    
        return result;
    };
    decodeProtocol(protocol){
        if(typeof protocol != 'string')throw new TypeError('protocol must be a string');
    
        let result = '';
        
        for(let i = 0; i < protocol.length; i++){
            const char = protocol[i];
            
            if(char == '%'){
                const code = parseInt(protocol.slice(i + 1, i + 3), 16);
                const decoded = String.fromCharCode(code);
                
                result += decoded;
                i += 2;
            }else{
                result += char;
            }
        }
    
        return result;
    }
};

class V1Client { 
    constructor(ctx) {
        this.ctx = ctx;
        this.gateway = ctx.bare + 'v1/';
        this.ws = {
            generateId: ctx.bare + 'ws-new-meta/',
            getMeta: ctx.bare + 'ws-meta/'
        };
        this.forward = ["accept-encoding", "accept-language", "sec-websocket-extensions", "sec-websocket-key", "sec-websocket-version"];
    };
    async fetch(input, opts = {}) {
        if (!input) throw 'Err';

        const raw = await self.fetch(this.gateway, {
            method: opts.method || 'GET',
            headers: this.prepareRequest(input, (opts.headers || {})),
            body: opts.body || null,
            credentials: 'omit'
        });

        return this.prepareResponse(raw);
    };
    prepareSocket(url, headers = {}, protocol = [], id) {
        url = new URL(url);

        if (typeof protocol === 'string' || !!protocol.length) {
            headers['Sec-WebSocket-Protocol'] = typeof protocol === 'string' ? protocol : protocol.join(', ')
        };

        const data = {
            remote: {
                host: url.hostname,
                port: url.port || url.protocol === 'wss:' ? '443' : '80',
                path: url.pathname + url.search,
                protocol: url.protocol
            },
            headers,
            forward_headers: this.forward,
        };

        if (id) data.id = id;

        return [ this.gateway, this.ctx.encodeProtocol(data) ];
    };
    prepareRequest(url, headers = {}) {
        url = new URL(url);
        return {
            "X-Bare-Host": url.hostname,
            "X-Bare-Port": url.port || url.protocol === 'https:' ? '443' : '80',
            'X-Bare-Protocol': url.protocol,
            "X-Bare-Path": url.pathname + url.search,
            "X-Bare-Headers": JSON.stringify(headers),
            "X-Bare-Forward-Headers": JSON.stringify(this.forward)
        };
    };
    prepareResponse(resp) {
        if (!resp.headers.has('x-bare-status')) throw new Error('Response status code not specified.');
        if (!resp.headers.has('x-bare-status-text')) throw new Error('Response status text not specified.');
        if (!resp.headers.has('x-bare-headers')) throw new Error('Response headers not specified.');

        const res = new Response(resp.body, {
            status: +resp.headers.get('x-bare-status'),
            statusText: resp.headers.get('x-bare-status-text'),
            headers: JSON.parse(resp.headers.get('x-bare-headers'))
        });

        res.raw = resp;
        return res;
    };
};

