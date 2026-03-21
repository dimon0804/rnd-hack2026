# syntax=docker/dockerfile:1
# Кэш npm ускоряет повторные сборки (нужен BuildKit: Docker Desktop по умолчанию включён).
FROM node:20-bookworm-slim

WORKDIR /app

# Долгие сети / registry: не обрывать слишком рано (могло выглядеть как «зависание»).
ENV NPM_CONFIG_FETCH_TIMEOUT=300000 \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_PROGRESS=true

COPY package.json package-lock.json ./
# Кэш npm (BuildKit): повторные сборки быстрее. Логи npm — чтобы было видно, что не «зависло».
RUN --mount=type=cache,target=/root/.npm \
    echo ">>> npm ci (первый прогон может занять несколько минут)" && \
    npm ci --no-audit --no-fund --loglevel=info

COPY docker-entrypoint.sh /usr/local/bin/frontend-entrypoint.sh
# Windows CRLF в скрипте даёт «no such file or directory» у shebang (/bin/sh\r).
RUN sed -i 's/\r$//' /usr/local/bin/frontend-entrypoint.sh && chmod +x /usr/local/bin/frontend-entrypoint.sh

COPY . .

EXPOSE 3000

ENV DEV_PROXY_TARGET=http://api-gateway:8000

# Явно через sh: не зависит от +x и shebang после сборки на Windows.
ENTRYPOINT ["sh", "/usr/local/bin/frontend-entrypoint.sh"]
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
