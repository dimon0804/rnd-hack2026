# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim

WORKDIR /app

ENV NPM_CONFIG_FETCH_TIMEOUT=300000 \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_PROGRESS=true

COPY package.json ./
RUN --mount=type=cache,target=/root/.npm \
    echo ">>> security-sim: npm install (image layer)" && \
    npm install --no-audit --no-fund --loglevel=info

COPY docker-entrypoint.sh /usr/local/bin/security-sim-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/security-sim-entrypoint.sh && chmod +x /usr/local/bin/security-sim-entrypoint.sh

COPY . .

EXPOSE 3001

ENV NEXT_TELEMETRY_DISABLED=1

ENTRYPOINT ["sh", "/usr/local/bin/security-sim-entrypoint.sh"]
CMD ["npm", "run", "dev"]
