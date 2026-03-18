FROM node:20-alpine AS builder

RUN npm install -g pnpm@9

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json ./
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/
COPY artifacts/bookkeeper/ ./artifacts/bookkeeper/

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @workspace/bookkeeper run build

RUN pnpm --filter @workspace/api-server run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/artifacts/api-server/dist/index.cjs ./artifacts/api-server/dist/index.cjs
COPY --from=builder /app/artifacts/bookkeeper/dist/public ./artifacts/bookkeeper/dist/public

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "artifacts/api-server/dist/index.cjs"]
