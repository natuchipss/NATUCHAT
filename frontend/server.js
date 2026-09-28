const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const port = Number(process.env.PORT || 8080);
const publicDirectory = path.join(__dirname, 'public');
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;

  if (pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (pathname === '/config.js') {
    const configuredUrl = process.env.WS_URL || process.env.BACKEND_HOST || '';
    const webSocketUrl = configuredUrl.startsWith('ws://') || configuredUrl.startsWith('wss://')
      ? configuredUrl
      : configuredUrl ? `wss://${configuredUrl}/ws` : '';
    const config = {
      webSocketUrl,
    };
    response.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(`window.NATUCHAT_CONFIG = ${JSON.stringify(config)};`);
    return;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.resolve(publicDirectory, relativePath);
  if (!filePath.startsWith(`${publicDirectory}${path.sep}`)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'content-type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
      'x-content-type-options': 'nosniff',
    });
    response.end(content);
  });
}).listen(port, '0.0.0.0', () => {
  console.log(`NAtUCHAT frontend escuchando en el puerto ${port}`);
});