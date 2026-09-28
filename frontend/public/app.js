const elements = {
  avatar: document.querySelector('#avatar'),
  changeName: document.querySelector('#change-name'),
  connectionDot: document.querySelector('#connection-dot'),
  connectionLabel: document.querySelector('#connection-label'),
  messageForm: document.querySelector('#message-form'),
  messageInput: document.querySelector('#message-input'),
  messages: document.querySelector('#messages'),
  nameDialog: document.querySelector('#name-dialog'),
  nameForm: document.querySelector('#name-form'),
  nameInput: document.querySelector('#name-input'),
  profileName: document.querySelector('#profile-name'),
  roomStatus: document.querySelector('#room-status'),
  sendButton: document.querySelector('#send-button'),
  userCount: document.querySelector('#user-count'),
};

let userName = localStorage.getItem('natuchat-name') || '';
let webSocket;
let reconnectTimer;

function setConnection(connected) {
  elements.connectionDot.className = `h-2 w-2 rounded-full ${connected ? 'bg-mint' : 'bg-amber-400'}`;
  elements.connectionLabel.textContent = connected ? 'En línea' : 'Reconectando';
  elements.roomStatus.textContent = connected ? 'Activa' : 'Conectando';
  elements.messageInput.disabled = !connected;
  elements.sendButton.disabled = !connected;
}

function addMessage({ type, name, text, sentAt, id }) {
  const item = document.createElement('li');
  if (type === 'system') {
    item.className = 'self-center rounded-full border border-line px-3 py-1.5 text-center text-[11px] text-muted';
    item.textContent = text;
  } else {
    item.className = `max-w-[88%] ${id === webSocket?.clientId ? 'self-end' : 'self-start'}`;
    const header = document.createElement('div');
    header.className = 'mb-1 flex items-center gap-2 px-1';
    const sender = document.createElement('span');
    sender.className = `text-xs font-bold ${id === webSocket?.clientId ? 'text-mint' : 'text-[#f2b880]'}`;
    sender.textContent = name;
    const time = document.createElement('time');
    time.className = 'font-mono text-[10px] text-muted';
    time.dateTime = new Date(sentAt).toISOString();
    time.textContent = new Date(sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    header.append(sender, time);
    const bubble = document.createElement('p');
    bubble.className = `whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 ${id === webSocket?.clientId ? 'rounded-tr-sm bg-[#315743] text-white' : 'rounded-tl-sm bg-ink text-paper'}`;
    bubble.textContent = text;
    item.append(header, bubble);
  }
  elements.messages.append(item);
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function getWebSocketUrl() {
  const configuredUrl = window.NATUCHAT_CONFIG?.webSocketUrl;
  if (configuredUrl) return configuredUrl;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:3001/ws`;
}

function connect() {
  clearTimeout(reconnectTimer);
  webSocket = new WebSocket(getWebSocketUrl());
  webSocket.addEventListener('open', () => {
    setConnection(true);
    if (userName) webSocket.send(JSON.stringify({ type: 'join', name: userName }));
  });
  webSocket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'welcome') webSocket.clientId = message.id;
    if (message.type === 'presence') elements.userCount.textContent = message.users;
    if (message.type === 'chat' || message.type === 'system') addMessage(message);
    if (message.type === 'error') addMessage({ type: 'system', text: message.message });
  });
  webSocket.addEventListener('close', () => {
    setConnection(false);
    reconnectTimer = setTimeout(connect, 1800);
  });
  webSocket.addEventListener('error', () => webSocket.close());
}

function updateProfile(name) {
  userName = name.trim().replace(/\s+/g, ' ').slice(0, 24);
  if (!userName) return;
  localStorage.setItem('natuchat-name', userName);
  elements.profileName.textContent = userName;
  elements.avatar.textContent = Array.from(userName)[0].toUpperCase();
  if (webSocket?.readyState === WebSocket.OPEN) {
    webSocket.send(JSON.stringify({ type: 'join', name: userName }));
  }
}

elements.nameForm.addEventListener('submit', (event) => {
  event.preventDefault();
  updateProfile(elements.nameInput.value);
  elements.nameDialog.close();
});

elements.changeName.addEventListener('click', () => {
  elements.nameInput.value = userName;
  elements.nameDialog.showModal();
  elements.nameInput.focus();
});

elements.messageForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = elements.messageInput.value.trim();
  if (!text || webSocket?.readyState !== WebSocket.OPEN) return;
  webSocket.send(JSON.stringify({ type: 'chat', text }));
  elements.messageInput.value = '';
  elements.messageInput.focus();
});

if (userName) updateProfile(userName);
else elements.nameDialog.showModal();
connect();