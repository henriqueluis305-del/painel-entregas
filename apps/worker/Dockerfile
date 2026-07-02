# Worker de planilhas — processo Node puro, fora do web (AD-06).
# build (da RAIZ do repo):  docker build -f apps/worker/Dockerfile -t painel-worker .

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY packages ./packages
COPY src/lib ./src/lib
COPY apps/worker ./apps/worker
USER node
CMD ["npx", "tsx", "apps/worker/src/index.ts"]
