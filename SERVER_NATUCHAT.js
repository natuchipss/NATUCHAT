const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:3000';

// Estructuras de datos en memoria
const clients = new Map(); // ws -> { username }
const messageHistory = []; // Almacena hasta 20 últimos mensajes
const MAX_HISTORY = 20;

// 1. Endpoint HTTP /health
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Crear el servidor WebSocket acoplado a HTTP
const wss = new WebSocket.Server({ noServer: true });

// Validación de Origen y captura de evento [upgrade]
server.on('upgrade', (request, socket, head) => {
  const origin = request.headers.origin;

  // Requisito 12: Verificar ALLOWED_ORIGINS sin usar '*'
  if (ALLOWED_ORIGINS !== '*' && origin !== ALLOWED_ORIGINS) {
    console.log(`[upgrade RECHAZADO] Origen no permitido: ${origin}`);
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }

  console.log(`[upgrade] Petición de conexión WS aceptada desde: ${origin || 'Desconocido'}`);
  
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Función auxiliar para emitir a todos los clientes
function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Función auxiliar para actualizar lista de usuarios conectados
function broadcastUserList() {
  const users = Array.from(clients.values()).map(c => c.username);
  broadcast({ type: 'user_list', users });
}

// Requisito 11: Sanitización básica contra XSS
function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Control del ciclo de vida de conexión WebSocket
wss.on('connection', (ws) => {
  ws.isAlive = true;

  // Requisito 9: Respuesta a PING
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (rawMessage) => {
    try {
      const data = JSON.parse(rawMessage);

      // Requisito 1: Identificación e ingreso de usuario
      if (data.type === 'join') {
        const username = sanitizeText(data.username).trim();
        if (!username || username.length > 20) {
          ws.send(JSON.stringify({ type: 'error', message: 'Nombre inválido' }));
          return;
        }

        clients.set(ws, { username });
        
        // Confirmación al cliente
        ws.send(JSON.stringify({ type: 'joined', username }));

        // Requisito 6: Enviar historial de mensajes previos
        ws.send(JSON.stringify({ type: 'history', messages: messageHistory }));

        // Requisito 4: Aviso de entrada a la conversación
        broadcast({ type: 'system', text: `${username} se ha unido al chat.` });

        // Requisito 3: Actualizar lista de conectados
        broadcastUserList();
      }

      // Requisito 2: Mensajes en vivo y Difusión
      else if (data.type === 'message') {
        const user = clients.get(ws);
        if (!user) return;

        const cleanText = sanitizeText(data.text).trim();

        // Requisito 10: Validación de vacíos, longitud y límite de caracteres
        if (!cleanText || cleanText.length > 500) return;

        const msgObj = {
          type: 'chat',
          username: user.username,
          text: cleanText,
          timestamp: new Date().toISOString()
        };

        // Guardar en historial
        messageHistory.push(msgObj);
        if (messageHistory.length > MAX_HISTORY) messageHistory.shift();

        // Difundir a todos
        broadcast(msgObj);
      }

      // Requisito 5: Evento «Está escribiendo...»
      else if (data.type === 'typing') {
        const user = clients.get(ws);
        if (!user) return;

        broadcast({
          type: 'typing',
          username: user.username,
          isTyping: !!data.isTyping
        });
      }

    } catch (err) {
      console.error('Error al procesar mensaje:', err);
    }
  });

  // Captura de evento [cierre]
  ws.on('close', (code, reason) => {
    const user = clients.get(ws);
    console.log(`[cierre] Conexión finalizada. Código: ${code}`);

    if (user) {
      clients.delete(ws);
      // Requisito 4: Aviso de salida
      broadcast({ type: 'system', text: `${user.username} ha salido del chat.` });
      // Requisito 3: Actualizar lista de conectados
      broadcastUserList();
    }
  });
});

// Requisito 9: Intervalo de Ping/Pong para cortar conexiones muertas
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('[ping/pong] Desconectando cliente inactivo...');
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(pingInterval);
});

// Iniciar servidor HTTP/WS
server.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});