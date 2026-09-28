# NAtUCHAT

Chat público en tiempo real con Node.js, WebSockets y una interfaz HTML/Tailwind.

## Ejecutar con Docker

Requiere Docker Desktop con Compose:

```sh
docker compose up --build
```

Abre [http://localhost:8080](http://localhost:8080). El backend queda disponible en `http://localhost:3001/health` y acepta conexiones WebSocket en `ws://localhost:3001/ws`.

También se pueden ejecutar por separado con Node.js y npm:

```sh
cd backend
npm install
npm start
```

```sh
cd frontend
npm start
```

El cliente escucha en el puerto `8080`; el servidor acepta `PORT` como variable de entorno. Para cambiar el WebSocket del cliente, define `WS_URL` con la URL completa, por ejemplo `wss://chat-api.example.com/ws`.

## Publicar en Render

El archivo `render.yaml` define dos servicios Docker gratuitos, sus comprobaciones de salud y la configuración WSS del cliente. Sube el proyecto a GitHub y, en Render, selecciona **New > Blueprint**, conecta ese repositorio y confirma la creación de los dos servicios. Render asignará una URL `onrender.com` a cada uno; comparte la del servicio `natuchat-frontend`.

En el plan gratuito los servicios pueden tardar en despertar después de un periodo inactivo. Los mensajes no se guardan y se pierden cuando el servidor se reinicia. Tailwind CSS y las fuentes se cargan desde CDN, por lo que el navegador necesita acceso a internet.

## Estructura

- `backend/`: servidor Node y WebSocket, endpoint `/health` y Dockerfile.
- `frontend/`: cliente HTML/Tailwind, servidor estático Node y Dockerfile.
- `docker-compose.yml`: ejecución local de los dos servicios.
- `render.yaml`: publicación de ambos servicios en Render.