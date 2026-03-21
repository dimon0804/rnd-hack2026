FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENV DEV_PROXY_TARGET=http://api-gateway:8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
