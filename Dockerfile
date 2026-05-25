# syntax=docker/dockerfile:1.7

# ============ Stage 1: dependencies (inclui dev p/ build) ============
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ============ Stage 2: build ============
FROM node:22-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Vite/TanStack Start gera .output/server/index.mjs com tudo bundleado (Nitro).
RUN npm run build

# ============ Stage 3: runtime (imagem final, pequena) ============
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Usuário não-root.
RUN addgroup -S app && adduser -S app -G app
USER app

COPY --from=build --chown=app:app /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
