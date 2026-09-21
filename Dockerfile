FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN rm -rf /app/node_modules /app/package-lock.json \
	&& npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]