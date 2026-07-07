const http = require('http');
const net = require('net');

const UPSTREAM_HOST = process.env.PROXY_HOST || '103.179.189.46';
const UPSTREAM_PORT = parseInt(process.env.PROXY_PORT || '19940');
const PROXY_USER = process.env.PROXY_USER || '3t1d';
const PROXY_PASS = process.env.PROXY_PASS || '3t1d';
const LOCAL_PORT = parseInt(process.env.LOCAL_PORT || '20000');

const authHeader = 'Basic ' + Buffer.from(`${PROXY_USER}:${PROXY_PASS}`).toString('base64');

const server = http.createServer((req, res) => {
  const upstream = http.request({
    host: UPSTREAM_HOST,
    port: UPSTREAM_PORT,
    method: req.method,
    path: req.url,
    headers: {
      ...req.headers,
      'Proxy-Authorization': authHeader,
    },
  }, (upRes) => {
    res.writeHead(upRes.statusCode, upRes.headers);
    upRes.pipe(res);
  });
  upstream.on('error', () => res.destroy());
  req.pipe(upstream);
});

server.on('connect', (req, clientSocket, head) => {
  const proxySocket = net.createConnection(UPSTREAM_PORT, UPSTREAM_HOST, () => {
    const connectReq = `CONNECT ${req.url} HTTP/1.1\r\nHost: ${req.url}\r\nProxy-Authorization: ${authHeader}\r\n\r\n`;
    proxySocket.write(connectReq);
  });

  let responseData = '';
  proxySocket.once('data', (chunk) => {
    responseData = chunk.toString();
    if (responseData.includes('200')) {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head && head.length) proxySocket.write(head);
      proxySocket.pipe(clientSocket);
      clientSocket.pipe(proxySocket);
    } else {
      clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      clientSocket.destroy();
      proxySocket.destroy();
    }
  });

  proxySocket.on('error', () => clientSocket.destroy());
  clientSocket.on('error', () => proxySocket.destroy());
});

server.listen(LOCAL_PORT, '0.0.0.0', () => {
  console.log(`Proxy relay chay tren port ${LOCAL_PORT} -> ${UPSTREAM_HOST}:${UPSTREAM_PORT}`);
});
