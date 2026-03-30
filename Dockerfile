FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm ci

COPY client/ ./client/
RUN npm run build --workspace=client

FROM node:22-alpine AS runner

WORKDIR /app
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm ci --workspace=server --omit=dev

COPY server/ ./server/
COPY --from=builder /app/server/public ./server/public

EXPOSE 8080
CMD ["node", "--env-file=.env", "server/src/index.js"]
