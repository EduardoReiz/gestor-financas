# Imagem do app para o servidor: o build do site (web) + a API (backend).

# ---- site ----
FROM node:24-slim AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---- API ----
FROM node:24-slim AS backend
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate && npm run build && npm prune --omit=dev

# ---- o que roda ----
FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production TZ=America/Sao_Paulo PASTA_WEB=/app/web ESCUTAR_EM=0.0.0.0
WORKDIR /app/backend
COPY --from=backend /backend/node_modules ./node_modules
COPY --from=backend /backend/dist ./dist
COPY --from=backend /backend/prisma ./prisma
COPY --from=backend /backend/package.json ./
COPY --from=web /web/dist /app/web
USER node
EXPOSE 3100
# aplica as migrações do banco e sobe a API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
