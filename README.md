# NAtUCHAT

Chat en tiempo real con servicios Node.js independientes.

## Ejecutar localmente

Abre dos terminales en la raíz del repositorio.

En la primera, inicia el backend:

```sh
cd backend
npm install
npm start
```

En la segunda, inicia el frontend:

```sh
cd frontend
npm start
```

Abre [http://localhost:8080](http://localhost:8080). El backend acepta conexiones WebSocket en `ws://localhost:3001/ws`.# NAtUCHAT Frontend

Cliente web de NAtUCHAT construido con Node.js, HTML y Tailwind CSS.

## Ejecutar

Requiere Node.js:

```sh
npm start
```

Abre [http://localhost:8080](http://localhost:8080). Para usar otro puerto, define `PORT`. Por defecto, el cliente busca el servidor WebSocket en `ws://localhost:3001/ws`; para cambiarlo, define `WS_URL` con la URL completa, por ejemplo `wss://chat.example.com/ws`.

El campo de mensaje permite escribir mientras intenta conectar. Para enviar mensajes, el servidor WebSocket debe estar en línea. Tailwind CSS y las fuentes se cargan desde CDN.