FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY docker-entrypoint.sh /usr/local/bin/frontend-entrypoint.sh
# Windows CRLF в скрипте даёт «no such file or directory» у shebang (/bin/sh\r).
RUN sed -i 's/\r$//' /usr/local/bin/frontend-entrypoint.sh && chmod +x /usr/local/bin/frontend-entrypoint.sh

COPY . .

EXPOSE 3000

ENV DEV_PROXY_TARGET=http://api-gateway:8000

# Явно через sh: не зависит от +x и shebang после сборки на Windows.
ENTRYPOINT ["sh", "/usr/local/bin/frontend-entrypoint.sh"]
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
