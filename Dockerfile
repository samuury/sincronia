# syntax=docker/dockerfile:1.7

# ============ Stage 1: deps (inclui dev p/ build) ============
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ============ Stage 2: build ============
FROM node:22-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Gera dist/client (estáticos) e dist/server/server.js (fetch handler, sem listen).
RUN npm run build

# ============ Stage 3: prod-deps (apenas deps de runtime) ============
FROM node:22-alpine AS prod-deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ============ Stage 4: runtime (imagem final) ============
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -S app && adduser -S app -G app
USER app

COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/server.mjs ./server.mjs
COPY --from=build --chown=app:app /app/package.json ./package.json

EXPOSE 3000

CMD ["node", "server.mjs"]
