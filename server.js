const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { WebSocketServer, WebSocket } = require('ws');

const port = Number(process.env.PORT || 3001);
const maxMessageLength = 500;
const clients = new Map();

const server = http.createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok', users: clients.size }));
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'Not found' }));
});

const webSocketServer = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  if (new URL(request.url, `http://${request.headers.host}`).pathname !== '/ws') {
    socket.destroy();
    return;
  }

  webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
    webSocketServer.emit('connection', webSocket, request);
  });
});

function broadcast(message) {
  const payload = JSON.stringify(message);
  for (const client of webSocketServer.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

webSocketServer.on('connection', (webSocket) => {
  const clientId = randomUUID();
  clients.set(webSocket, { id: clientId, name: 'Invitado' });
  webSocket.send(JSON.stringify({ type: 'welcome', id: clientId }));
  broadcast({ type: 'presence', users: clients.size });

  webSocket.on('message', (rawMessage) => {
    let message;
    try {
      message = JSON.parse(rawMessage.toString());
    } catch {
      webSocket.send(JSON.stringify({ type: 'error', message: 'Formato de mensaje inválido.' }));
      return;
    }

    const client = clients.get(webSocket);
    if (!client) return;

    if (message.type === 'join') {
      if (typeof message.name !== 'string') return;
      const name = message.name.trim().replace(/\s+/g, ' ').slice(0, 24);
      if (name) client.name = name;
      broadcast({ type: 'system', message: `${client.name} se unió al chat.` });
      return;
    }

    if (message.type === 'chat') {
      if (typeof message.text !== 'string') return;
      const text = message.text.trim().slice(0, maxMessageLength);
      if (text) broadcast({ type: 'chat', id: client.id, name: client.name, text, sentAt: Date.now() });
    }
  });

  webSocket.on('close', () => {
    const client = clients.get(webSocket);
    clients.delete(webSocket);
    if (client) {
      broadcast({ type: 'system', message: `${client.name} salió del chat.` });
      broadcast({ type: 'presence', users: clients.size });
    }
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`NAtUCHAT backend escuchando en el puerto ${port}`);
});