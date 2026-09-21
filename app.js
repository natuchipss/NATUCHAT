(() => {
  'use strict';

  const elements = {
    modal: document.querySelector('#username-modal'),
    usernameForm: document.querySelector('#username-form'),
    usernameInput: document.querySelector('#username-input'),
    usernameError: document.querySelector('#username-error'),
    messages: document.querySelector('#messages'),
    messageForm: document.querySelector('#message-form'),
    messageInput: document.querySelector('#message-input'),
    sendButton: document.querySelector('#send-button'),
    typingIndicator: document.querySelector('#typing-indicator'),
    userList: document.querySelector('#user-list'),
    userCount: document.querySelector('#user-count'),
    connectionStatus: document.querySelector('#connection-status'),
    connectionDot: document.querySelector('#connection-dot')
  };

  const state = {
    ws: null,
    username: '',
    reconnectAttempt: 0,
    reconnectTimer: null,
    typingTimer: null,
    statusTimer: null,
    typingUsers: new Set(),
    hasJoined: false
  };

  const MAX_RECONNECT_DELAY = 30000;
  const TYPING_DELAY = 900;

  function setConnectionStatus() {
    const readyState = state.ws ? state.ws.readyState : WebSocket.CLOSED;
    const statuses = {
      [WebSocket.CONNECTING]: ['Conectando...', 'connecting'],
      [WebSocket.OPEN]: ['Conectado', 'open'],
      [WebSocket.CLOSING]: ['Cerrando...', 'closing'],
      [WebSocket.CLOSED]: ['Desconectado', 'closed']
    };
    const [label, modifier] = statuses[readyState] || statuses[WebSocket.CLOSED];

    elements.connectionStatus.textContent = label;
    elements.connectionDot.className = `status-dot status-dot--${modifier}`;
    elements.messageInput.disabled = readyState !== WebSocket.OPEN || !state.hasJoined;
    elements.sendButton.disabled = elements.messageInput.disabled;
  }

  function startStatusMonitor() {
    window.clearInterval(state.statusTimer);
    setConnectionStatus();
    state.statusTimer = window.setInterval(() => {
      // Leer readyState directamente mantiene el badge sincronizado con el socket real.
      setConnectionStatus();
      if (state.ws && state.ws.readyState === WebSocket.CLOSED) {
        window.clearInterval(state.statusTimer);
      }
    }, 250);
  }

  function appendText(parent, text) {
    parent.appendChild(document.createTextNode(String(text ?? '')));
  }

  function renderSystemMessage(text) {
    const message = document.createElement('p');
    message.className = 'system-message';
    appendText(message, text);
    elements.messages.appendChild(message);
    scrollToLatest();
  }

  function renderChatMessage(data) {
    const article = document.createElement('article');
    const isOwnMessage = data.username === state.username;
    article.className = `message${isOwnMessage ? ' message--own' : ''}`;

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    appendText(meta, `${data.username || 'Usuario'}${data.timestamp ? ` · ${formatTime(data.timestamp)}` : ''}`);

    const body = document.createElement('p');
    body.className = 'message-body';
    appendText(body, data.text);

    article.append(meta, body);
    elements.messages.appendChild(article);
    scrollToLatest();
  }

  function renderHistory(messages) {
    if (!Array.isArray(messages)) return;
    messages.forEach((message) => renderChatMessage(message));
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function scrollToLatest() {
    elements.messages.scrollTop = elements.messages.scrollHeight;
  }

  function renderUsers(users) {
    const safeUsers = Array.isArray(users) ? users : [];
    elements.userList.replaceChildren();
    elements.userCount.textContent = String(safeUsers.length);

    safeUsers.forEach((username) => {
      const item = document.createElement('li');
      const avatar = document.createElement('span');
      const name = document.createElement('span');
      avatar.className = 'user-avatar';
      name.className = 'user-name';
      appendText(avatar, String(username).charAt(0).toUpperCase() || '?');
      appendText(name, username);
      item.append(avatar, name);
      elements.userList.appendChild(item);
    });
  }

  function renderTypingIndicator() {
    const users = [...state.typingUsers];
    if (users.length === 0) {
      elements.typingIndicator.textContent = '';
    } else if (users.length === 1) {
      elements.typingIndicator.textContent = `${users[0]} está escribiendo...`;
    } else {
      elements.typingIndicator.textContent = `${users.length} personas están escribiendo...`;
    }
  }

  function send(data) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  function sendJoin() {
    state.hasJoined = false;
    setConnectionStatus();
    send({ type: 'join', username: state.username });
  }

  function connect() {
    window.clearTimeout(state.reconnectTimer);
    state.ws = new WebSocket(BACKEND_URL);
    startStatusMonitor();

    state.ws.addEventListener('open', () => {
      state.reconnectAttempt = 0;
      sendJoin();
    });

    state.ws.addEventListener('message', (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (data.type) {
        case 'joined':
          state.hasJoined = true;
          elements.modal.hidden = true;
          elements.messageInput.focus();
          setConnectionStatus();
          break;
        case 'history':
          renderHistory(data.messages);
          break;
        case 'chat':
          renderChatMessage(data);
          break;
        case 'system':
          renderSystemMessage(data.text);
          break;
        case 'user_list':
          renderUsers(data.users);
          break;
        case 'typing':
          if (data.username && data.username !== state.username) {
            if (data.isTyping) state.typingUsers.add(data.username);
            else state.typingUsers.delete(data.username);
            renderTypingIndicator();
          }
          break;
        case 'error':
          elements.usernameError.textContent = data.message || 'No se pudo entrar al chat.';
          elements.modal.hidden = false;
          break;
        default:
          break;
      }
    });

    state.ws.addEventListener('close', () => {
      state.hasJoined = false;
      state.typingUsers.clear();
      renderTypingIndicator();
      setConnectionStatus();
      scheduleReconnect();
    });

    state.ws.addEventListener('error', () => {
      // close se encarga de iniciar la reconexión y evita programarla dos veces.
      setConnectionStatus();
    });
  }

  function scheduleReconnect() {
    if (!state.username || state.reconnectTimer) return;
    const delay = Math.min(1000 * (2 ** state.reconnectAttempt), MAX_RECONNECT_DELAY);
    state.reconnectAttempt += 1;
    state.reconnectTimer = window.setTimeout(() => {
      state.reconnectTimer = null;
      connect();
    }, delay);
  }

  function handleTyping() {
    send({ type: 'typing', isTyping: true });
    window.clearTimeout(state.typingTimer);
    state.typingTimer = window.setTimeout(() => {
      send({ type: 'typing', isTyping: false });
    }, TYPING_DELAY);
  }

  elements.usernameForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const username = elements.usernameInput.value.trim();
    if (!username || username.length > 20) {
      elements.usernameError.textContent = 'Usa un nombre de 1 a 20 caracteres.';
      return;
    }
    elements.usernameError.textContent = '';
    state.username = username;
    elements.usernameInput.disabled = true;
    connect();
  });

  elements.messageForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = elements.messageInput.value.trim();
    if (!text || text.length > 500 || !send({ type: 'message', text })) return;
    elements.messageInput.value = '';
    window.clearTimeout(state.typingTimer);
    send({ type: 'typing', isTyping: false });
  });

  elements.messageInput.addEventListener('input', () => {
    if (elements.messageInput.value.trim()) handleTyping();
    else {
      window.clearTimeout(state.typingTimer);
      send({ type: 'typing', isTyping: false });
    }
  });

  elements.modal.hidden = false;
  setConnectionStatus();
})();
