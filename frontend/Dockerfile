FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY docker-entrypoint.sh /usr/local/bin/frontend-entrypoint.sh
RUN chmod +x /usr/local/bin/frontend-entrypoint.sh

COPY . .

EXPOSE 3000

ENV DEV_PROXY_TARGET=http://api-gateway:8000

# Не класть entrypoint в /app: том ./frontend:/app перезаписывает каталог, и скрипт с хоста (Windows) без +x / с CRLF ломает старт.
ENTRYPOINT ["/usr/local/bin/frontend-entrypoint.sh"]
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
